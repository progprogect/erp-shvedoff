import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, desc, asc, inArray, isNull } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { requireExportPermission } from '../middleware/permissions';
import { createError } from '../middleware/errorHandler';
import { 
  fullProductionSync, 
  syncProductionQueueToTasks, 
  createTasksForPendingOrders, 
  getSyncStatistics 
} from '../utils/productionSynchronizer';
import { ExcelExporter } from '../utils/excelExporter';
import { performStockOperation, getStockInfo } from '../utils/stockManager';
import { 
  validateProductionPlanning
} from '../utils/productionPlanning';

const router = express.Router();

// GET /api/production/queue - Get production queue
router.get('/queue', authenticateToken, requirePermission('production', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const { status, priority, limit = 50, offset = 0 } = req.query;

    let whereConditions = [];

    if (status) {
      whereConditions.push(eq(schema.productionQueue.status, status as any));
    }

    const productionQueue = await db.query.productionQueue.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        product: {
          with: {
            category: true,
            stock: true
          }
        }
      },
      orderBy: [
        desc(schema.productionQueue.priority),
        asc(schema.productionQueue.createdAt)
      ],
      limit: Number(limit),
      offset: Number(offset)
    });

    // Get orders data for items that have orderId
    const queueWithOrders = await Promise.all(
      productionQueue.map(async (item) => {
        if (item.orderId) {
          const order = await db.query.orders.findFirst({
            where: eq(schema.orders.id, item.orderId),
            with: {
              manager: {
                columns: {
                  id: true,
                  username: true,
                  fullName: true
                }
              }
            }
          });
          return { ...item, order };
        }
        return { ...item, order: null };
      })
    );

    res.json({
      success: true,
      data: queueWithOrders
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/queue/:id - Get specific production queue item
router.get('/queue/:id', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const productionId = Number(req.params.id);

    const productionItem = await db.query.productionQueue.findFirst({
      where: eq(schema.productionQueue.id, productionId),
      with: {
        product: {
          with: {
            category: true,
            stock: true
          }
        }
      }
    });

    if (!productionItem) {
      return next(createError('Production item not found', 404));
    }

    // Get order data if exists
    let order = null;
    if (productionItem.orderId) {
      order = await db.query.orders.findFirst({
        where: eq(schema.orders.id, productionItem.orderId),
        with: {
          manager: {
            columns: {
              id: true,
              username: true,
              fullName: true
            }
          },
          items: {
            with: {
              product: true
            }
          }
        }
      });
    }

    res.json({
      success: true,
      data: { ...productionItem, order }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/production/queue/:id/status - Update production status
router.put('/queue/:id/status', authenticateToken, requirePermission('production', 'edit'), async (req: AuthRequest, res, next) => {
  try {
    const productionId = Number(req.params.id);
    const { status, notes } = req.body;
    const userId = req.user!.id;

    if (!status) {
      return next(createError('Status is required', 400));
    }

    // Get current production item
    const productionItem = await db.query.productionQueue.findFirst({
      where: eq(schema.productionQueue.id, productionId),
      with: {
        product: true
      }
    });

    if (!productionItem) {
      return next(createError('Production item not found', 404));
    }

    const updateData: any = {};

    // Set status-specific fields
    if (status === 'in_progress') {
      updateData.status = status;
      updateData.actualStartDate = new Date();
    } else if (status === 'completed') {
      updateData.status = status;
      updateData.actualCompletionDate = new Date();
      
      // When production is completed, add products to stock
      await db.update(schema.stock)
        .set({
          currentStock: sql`${schema.stock.currentStock} + ${productionItem.quantity}`,
          updatedAt: new Date()
        })
        .where(eq(schema.stock.productId, productionItem.productId));

      // Log stock movement
      await db.insert(schema.stockMovements).values({
        productId: productionItem.productId,
        movementType: 'incoming',
        quantity: productionItem.quantity,
        referenceId: productionId,
        referenceType: 'production',
        comment: 'Производство завершено',
        userId
      });

      // If this production item is linked to an order, update order status
      if (productionItem.orderId) {
        // Пересчитываем статус заказа на основе реального анализа доступности
        try {
          const { analyzeOrderAvailability, cancelUnnecessaryProductionTasks } = await import('../utils/orderStatusCalculator');
          const orderAnalysis = await analyzeOrderAvailability(productionItem.orderId);
          
          await db.update(schema.orders)
            .set({
              status: orderAnalysis.status as any,
              updatedAt: new Date()
            })
            .where(eq(schema.orders.id, productionItem.orderId));

          // Отменяем ненужные производственные задания если все товары доступны
          const cancelled = await cancelUnnecessaryProductionTasks(productionItem.orderId);
          if (cancelled.cancelled > 0) {
            await db.insert(schema.orderMessages).values({
              orderId: productionItem.orderId,
              userId,
              message: `🚫 Автоматически отменено ${cancelled.cancelled} ненужных производственных заданий - товары уже доступны`
            });
          }

          // Уведомление о завершении производственного задания
          await db.insert(schema.orderMessages).values({
            orderId: productionItem.orderId,
            userId,
            message: `📦 Производственное задание выполнено: произведено ${productionItem.quantity} шт.`
          });

          // Проверяем готовность заказа к отгрузке только если все товары в наличии
          const allItemsAvailable = orderAnalysis.items.every(item => 
            item.available_quantity >= item.required_quantity
          );

          if (allItemsAvailable && (orderAnalysis.status === 'ready' || orderAnalysis.status === 'confirmed')) {
            await db.insert(schema.orderMessages).values({
              orderId: productionItem.orderId,
              userId,
              message: `✅ Заказ готов к отгрузке! Все товары в наличии на складе.`
            });
          }
        } catch (error) {
          console.error('Ошибка пересчета статуса заказа:', error);
        }
      }
    } else {
      updateData.status = status;
    }

    if (notes) {
      updateData.notes = notes;
    }

    // Update production item
    const updatedItem = await db.update(schema.productionQueue)
      .set(updateData)
      .where(eq(schema.productionQueue.id, productionId))
      .returning();

    res.json({
      success: true,
      data: updatedItem[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/auto-queue - Automatically add orders without stock to production queue
router.post('/auto-queue', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    // Find orders with items that don't have enough stock
    // Ищем заказы в статусах: new, confirmed, in_production - все которые могут требовать производства
    const ordersNeedingProduction = await db.query.orders.findMany({
      where: sql`${schema.orders.status} IN ('new', 'confirmed', 'in_production')`,
      with: {
        items: {
          with: {
            product: {
              with: {
                stock: true
              }
            }
          }
        }
      }
    });

    const productionItemsToAdd = [];

    for (const order of ordersNeedingProduction) {
      for (const item of order.items) {
        const stock = item.product.stock;
        const availableStock = stock ? (stock.currentStock - stock.reservedStock) : 0;
        const shortfall = item.quantity - (item.reservedQuantity || 0);

        if (shortfall > 0) {
          // Check if this item is already in production queue
          const existingProductionItem = await db.query.productionQueue.findFirst({
            where: and(
              eq(schema.productionQueue.orderId, order.id),
              eq(schema.productionQueue.productId, item.productId),
              eq(schema.productionQueue.status, 'queued')
            )
          });

          if (!existingProductionItem) {
            productionItemsToAdd.push({
              orderId: order.id,
              productId: item.productId,
              quantity: shortfall,
              priority: order.priority === 'urgent' ? 5 : 
                       order.priority === 'high' ? 4 : 
                       order.priority === 'normal' ? 3 : 2,
              estimatedStartDate: null,
              estimatedCompletionDate: null,
              status: 'queued' as const,
              notes: `Автоматически добавлено в очередь для заказа ${order.orderNumber}`
            });
          }
        }
      }
    }

    if (productionItemsToAdd.length > 0) {
      const newProductionItems = await db.insert(schema.productionQueue).values(productionItemsToAdd).returning();

      // Update order status to in_production for affected orders
      const affectedOrderIds = [...new Set(productionItemsToAdd.map(item => item.orderId))];
      for (const orderId of affectedOrderIds) {
        await db.update(schema.orders)
          .set({
            status: 'in_production',
            updatedAt: new Date()
          })
          .where(eq(schema.orders.id, orderId));
      }

      res.json({
        success: true,
        message: `Added ${newProductionItems.length} items to production queue`,
        data: newProductionItems
      });
    } else {
      res.json({
        success: true,
        message: 'No items need to be added to production queue',
        data: []
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/production/queue - Manually add production task to queue
router.post('/queue', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity, priority = 3, notes } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return next(createError('Product ID and positive quantity are required', 400));
    }

    // Check if product exists
    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, productId)
    });

    if (!product) {
      return next(createError('Product not found', 404));
    }

    // Create production queue item
    const newProductionItem = await db.insert(schema.productionQueue).values({
      productId: Number(productId),
      quantity: Number(quantity),
      priority: Number(priority),
      status: 'queued',
      notes: notes || `Ручное создание задания на производство`,
      createdAt: new Date()
    }).returning();

    // Get complete production item with product data
    const completeItem = await db.query.productionQueue.findFirst({
      where: eq(schema.productionQueue.id, newProductionItem[0].id),
      with: {
        product: {
          with: {
            category: true,
            stock: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: completeItem,
      message: 'Задание добавлено в очередь производства'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/stats - Get production statistics
router.get('/stats', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const stats = await Promise.all([
      // Count by status
      db.select({ 
        status: schema.productionQueue.status,
        count: sql`COUNT(*)`.as('count')
      })
      .from(schema.productionQueue)
      .groupBy(schema.productionQueue.status),

      // Count urgent items
      db.select({ count: sql`COUNT(*)`.as('count') })
      .from(schema.productionQueue)
      .where(and(
        eq(schema.productionQueue.priority, 5),
        eq(schema.productionQueue.status, 'queued')
      )),

      // Count overdue items (estimated completion date passed)
      db.select({ count: sql`COUNT(*)`.as('count') })
      .from(schema.productionQueue)
      .where(and(
        sql`${schema.productionQueue.estimatedCompletionDate} < NOW()`,
        eq(schema.productionQueue.status, 'in_progress')
      ))
    ]);

    const statusCounts = stats[0];
    const urgentCount = stats[1][0]?.count || 0;
    const overdueCount = stats[2][0]?.count || 0;

    res.json({
      success: true,
      data: {
        byStatus: statusCounts,
        urgentItems: Number(urgentCount),
        overdueItems: Number(overdueCount)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================== НОВЫЕ РОУТЫ ДЛЯ ПРОИЗВОДСТВЕННЫХ ЗАДАНИЙ ====================

// GET /api/production/tasks - Get production tasks
router.get('/tasks', authenticateToken, requirePermission('production', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let whereConditions = [];

    if (status) {
      whereConditions.push(eq(schema.productionTasks.status, status as any));
    }

    const tasks = await db.query.productionTasks.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        order: {
          with: {
            manager: {
              columns: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        product: {
          with: {
            category: true,
            stock: true,
            surface: true,
            logo: true,
            material: true,
            bottomType: true,
            puzzleType: true,
            rollComposition: {
              with: {
                carpet: {
                  columns: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            manager: {
              columns: {
                id: true,
                username: true,
                fullName: true
              }
            }
          },
          // Добавляем недостающие поля для отображения в UI
          columns: {
            article: true,
            productType: true,
            purNumber: true,
            pressType: true,
            grade: true,
            borderType: true,
            tags: true,
            notes: true,
            carpetEdgeType: true,
            carpetEdgeSides: true,
            carpetEdgeStrength: true,
            puzzleSides: true,
            dimensions: true,
            weight: true,
            matArea: true,
            characteristics: true,
            puzzleOptions: true,
            surfaceIds: true
          }
        },
        createdByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        assignedToUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        startedByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        completedByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        extras: {
          with: {
            product: true
          }
        }
      },
      orderBy: [
        asc(schema.productionTasks.sortOrder),
        desc(schema.productionTasks.priority),
        desc(schema.productionTasks.createdAt)
      ],
      limit: Number(limit),
      offset: Number(offset)
    });

    // Загружаем множественные поверхности для каждого товара
    const tasksWithSurfaces = await Promise.all(
      tasks.map(async (task) => {
        let surfaces: any[] = [];
        if (task.product.surfaceIds && task.product.surfaceIds.length > 0) {
          surfaces = await db.query.productSurfaces.findMany({
            where: inArray(schema.productSurfaces.id, task.product.surfaceIds)
          });
        }
        
        return {
          ...task,
          product: {
            ...task.product,
            surfaces
          }
        };
      })
    );

    res.json({
      success: true,
      data: tasksWithSurfaces
    });
  } catch (error) {
    next(error);
  }
});

// === КАЛЕНДАРНЫЕ И СТАТИСТИЧЕСКИЕ API ===

// GET /api/production/tasks/calendar - Получить задания за период для календаря
router.get('/tasks/calendar', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return next(createError('Укажите даты начала и окончания периода', 400));
    }

    const tasks = await db.query.productionTasks.findMany({
      where: and(
        sql`${schema.productionTasks.plannedStartDate} IS NOT NULL`,
        sql`DATE(${schema.productionTasks.plannedStartDate}) BETWEEN ${startDate} AND ${endDate}`
      ),
      with: {
        product: {
          columns: {
            id: true,
            name: true,
            article: true
          }
        },
        order: {
          columns: {
            id: true,
            orderNumber: true,
            customerName: true
          }
        }
      },
      orderBy: [
        asc(schema.productionTasks.plannedStartDate),
        asc(schema.productionTasks.plannedEndDate),
        desc(schema.productionTasks.priority)
      ]
    });

    const calendarTasks = tasks.map(task => ({
      id: task.id,
      plannedStartDate: task.plannedStartDate,
      plannedEndDate: task.plannedEndDate,
      productName: task.product.name,
      requestedQuantity: task.requestedQuantity,
      status: task.status,
      priority: task.priority,
      orderId: task.orderId,
      orderNumber: task.order?.orderNumber,
      customerName: task.order?.customerName
    }));

    res.json({
      success: true,
      data: calendarTasks
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/statistics/daily - Получить статистику по дням за период
router.get('/statistics/daily', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return next(createError('Укажите даты начала и окончания периода', 400));
    }

    // Валидация дат
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(createError('Некорректный формат даты', 400));
    }

    // Получаем статистику по всем заданиям в периоде (не только завершенным)
    const dailyStats = await db
      .select({
        production_date: sql`DATE(COALESCE(${schema.productionTasks.completedAt}, ${schema.productionTasks.startedAt}, ${schema.productionTasks.createdAt}))`.as('production_date'),
        total_tasks: sql<number>`COUNT(*)`.as('total_tasks'),
        pending_tasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'pending' THEN 1 END)`.as('pending_tasks'),
        in_progress_tasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'in_progress' THEN 1 END)`.as('in_progress_tasks'),
        paused_tasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'paused' THEN 1 END)`.as('paused_tasks'),
        completed_tasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'completed' THEN 1 END)`.as('completed_tasks'),
        cancelled_tasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'cancelled' THEN 1 END)`.as('cancelled_tasks'),
        total_requested: sql<number>`COALESCE(SUM(requested_quantity), 0)`.as('total_requested'),
        total_produced: sql<number>`COALESCE(SUM(produced_quantity), 0)`.as('total_produced'),
        total_quality: sql<number>`COALESCE(SUM(quality_quantity), 0)`.as('total_quality'),
        total_defects: sql<number>`COALESCE(SUM(defect_quantity), 0)`.as('total_defects')
      })
      .from(schema.productionTasks)
      .where(and(
        sql`COALESCE(${schema.productionTasks.completedAt}, ${schema.productionTasks.startedAt}, ${schema.productionTasks.createdAt}) >= ${start.toISOString()}::timestamp`,
        sql`COALESCE(${schema.productionTasks.completedAt}, ${schema.productionTasks.startedAt}, ${schema.productionTasks.createdAt}) <= ${end.toISOString()}::timestamp + INTERVAL '1 day'`
      ))
      .groupBy(sql`DATE(COALESCE(${schema.productionTasks.completedAt}, ${schema.productionTasks.startedAt}, ${schema.productionTasks.createdAt}))`)
      .orderBy(sql`DATE(COALESCE(${schema.productionTasks.completedAt}, ${schema.productionTasks.startedAt}, ${schema.productionTasks.createdAt}))`);

    res.json({
      success: true,
      data: dailyStats
    });
  } catch (error) {
    console.error('❌ Ошибка получения дневной статистики:', error);
    next(error);
  }
});

// GET /api/production/statistics/detailed - Получить детальную статистику с разбивкой по товарам  
router.get('/statistics/detailed', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate, period = 'day' } = req.query;

    if (!startDate || !endDate) {
      return next(createError('Укажите даты начала и окончания периода', 400));
    }

    // Валидация дат
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(createError('Некорректный формат даты', 400));
    }

    // Получаем статистику по всем заданиям в периоде (не только завершенным)
    const detailedStats = await db
      .select({
        productId: schema.productionTasks.productId,
        productName: schema.products.name,
        productArticle: schema.products.article,
        totalTasks: sql<number>`COUNT(*)`,
        pendingTasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'pending' THEN 1 END)`,
        inProgressTasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'in_progress' THEN 1 END)`,
        pausedTasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'paused' THEN 1 END)`,
        completedTasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'completed' THEN 1 END)`,
        cancelledTasks: sql<number>`COUNT(CASE WHEN ${schema.productionTasks.status} = 'cancelled' THEN 1 END)`,
        totalRequested: sql<number>`COALESCE(SUM(requested_quantity), 0)`,
        totalProduced: sql<number>`COALESCE(SUM(produced_quantity), 0)`,
        qualityQuantity: sql<number>`COALESCE(SUM(quality_quantity), 0)`,
        defectQuantity: sql<number>`COALESCE(SUM(defect_quantity), 0)`
      })
      .from(schema.productionTasks)
      .leftJoin(schema.products, eq(schema.productionTasks.productId, schema.products.id))
      .where(and(
        sql`COALESCE(${schema.productionTasks.completedAt}, ${schema.productionTasks.startedAt}, ${schema.productionTasks.createdAt}) >= ${start.toISOString()}::timestamp`,
        sql`COALESCE(${schema.productionTasks.completedAt}, ${schema.productionTasks.startedAt}, ${schema.productionTasks.createdAt}) <= ${end.toISOString()}::timestamp + INTERVAL '1 day'`
      ))
      .groupBy(
        schema.productionTasks.productId, 
        schema.products.name, 
        schema.products.article
      )
      .orderBy(schema.products.name);

    res.json({
      success: true,
      data: detailedStats
    });
  } catch (error) {
    console.error('❌ Ошибка получения детальной статистики:', error);
    next(error);
  }
});

// PUT /api/production/tasks/:id/schedule - Обновить планирование задания
router.put('/tasks/:id/schedule', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { plannedStartDate, plannedEndDate } = req.body;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    // Обновляем планирование
    const [updatedTask] = await db.update(schema.productionTasks)
      .set({
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        updatedAt: new Date()
      })
      .where(eq(schema.productionTasks.id, taskId))
      .returning();

    // Получаем полные данные обновленного задания
    const fullTask = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId),
      with: {
        order: true,
        product: {
          with: {
            category: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: fullTask,
      message: 'Планирование задания обновлено'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/tasks/by-product - Группировка заданий по товарам
router.get('/tasks/by-product', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { status = 'pending,in_progress' } = req.query;
    
    // Валидируем и очищаем статусы
    const validStatuses = ['pending', 'in_progress', 'paused', 'completed', 'cancelled'];
    const statusList = (status as string)
      .split(',')
      .map(s => s.trim())
      .filter(s => validStatuses.includes(s));

    // Если нет валидных статусов, используем все
    if (statusList.length === 0) {
      statusList.push(...validStatuses);
    }

    // Получаем активные задания
    const tasks = await db.query.productionTasks.findMany({
      where: statusList.length > 0 ? inArray(schema.productionTasks.status, statusList as any) : undefined,
      with: {
        order: {
          columns: {
            id: true,
            orderNumber: true,
            customerName: true,
            priority: true,
            deliveryDate: true
          }
        },
        product: {
          with: {
            category: true,
            stock: true,
            surface: true,
            logo: true,
            material: true,
            bottomType: true,
            puzzleType: true,
            rollComposition: {
              with: {
                carpet: {
                  columns: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            manager: {
              columns: {
                id: true,
                username: true,
                fullName: true
              }
            }
          },
          // Добавляем недостающие поля для отображения в UI
          columns: {
            article: true,
            productType: true,
            purNumber: true,
            pressType: true,
            grade: true,
            borderType: true,
            tags: true,
            notes: true,
            carpetEdgeType: true,
            carpetEdgeSides: true,
            carpetEdgeStrength: true,
            puzzleSides: true,
            dimensions: true,
            weight: true,
            matArea: true,
            characteristics: true,
            puzzleOptions: true,
            surfaceIds: true
          }
        }
      },
      orderBy: [
        desc(schema.productionTasks.priority),      // Сначала по приоритету задания
        asc(schema.productionTasks.sortOrder),     // Потом по порядку выполнения
        desc(schema.productionTasks.createdAt)     // Затем по времени создания
      ]
    });

    // Загружаем множественные поверхности для каждого товара
    const tasksWithSurfaces = await Promise.all(
      tasks.map(async (task) => {
        let surfaces: any[] = [];
        if (task.product.surfaceIds && task.product.surfaceIds.length > 0) {
          surfaces = await db.query.productSurfaces.findMany({
            where: inArray(schema.productSurfaces.id, task.product.surfaceIds)
          });
        }
        
        return {
          ...task,
          product: {
            ...task.product,
            surfaces
          }
        };
      })
    );

    // Группируем по товарам
    const groupedTasks = tasksWithSurfaces.reduce((acc, task) => {
      const productId = task.productId;
      
      if (!acc[productId]) {
        acc[productId] = {
          product: task.product,
          totalQuantity: 0,
          tasks: [],
          // Отслеживаем максимальный приоритет и минимальный sortOrder для сортировки групп
          maxPriority: task.priority || 1,
          minSortOrder: task.sortOrder || 0,
          earliestCreated: task.createdAt ? new Date(task.createdAt) : new Date()
        };
      }
      
      acc[productId].totalQuantity += task.requestedQuantity;
      acc[productId].tasks.push(task);
      
      // Обновляем приоритет и порядок для группы
      const taskPriority = task.priority || 1;
      if (taskPriority > acc[productId].maxPriority) {
        acc[productId].maxPriority = taskPriority;
      }
      if ((task.sortOrder || 0) < acc[productId].minSortOrder) {
        acc[productId].minSortOrder = task.sortOrder || 0;
      }
      const taskCreated = task.createdAt ? new Date(task.createdAt) : new Date();
      if (taskCreated < acc[productId].earliestCreated) {
        acc[productId].earliestCreated = taskCreated;
      }
      
      return acc;
    }, {} as Record<number, any>);

    // Преобразуем в массив и сортируем группы
    const result = Object.values(groupedTasks)
      .sort((a, b) => {
        // Сначала по максимальному приоритету заданий в группе (убывание)
        if (a.maxPriority !== b.maxPriority) {
          return b.maxPriority - a.maxPriority;
        }
        
        // Затем по минимальному sortOrder в группе (возрастание)
        if (a.minSortOrder !== b.minSortOrder) {
          return a.minSortOrder - b.minSortOrder;
        }
        
        // Наконец по времени создания самого раннего задания (возрастание)
        return a.earliestCreated.getTime() - b.earliestCreated.getTime();
      })
      .map(group => ({
        product: group.product,
        totalQuantity: group.totalQuantity,
        tasks: group.tasks
      }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/complete-by-product - Массовое завершение заданий по товару
router.post('/tasks/complete-by-product', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, producedQuantity, qualityQuantity, secondGradeQuantity = 0, libertyGradeQuantity = 0, defectQuantity, productionDate, notes } = req.body;
    const userId = req.user!.id;

    if (!productId || !producedQuantity || producedQuantity <= 0) {
      return next(createError('Необходимо указать товар и положительное количество произведенного', 400));
    }

    // Получаем информацию о продукте
    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, productId)
    });

    if (!product) {
      return next(createError('Товар не найден', 404));
    }

    // Валидация: произведенное = качественных + второй сорт + Либерти + брак
    if (qualityQuantity + secondGradeQuantity + libertyGradeQuantity + defectQuantity !== producedQuantity) {
      return next(createError('Сумма годных, второго сорта, Либерти и брака должна равняться произведенному количеству', 400));
    }

    // Получаем активные задания для этого товара, отсортированные по приоритету
    const activeTasks = await db.query.productionTasks.findMany({
      where: and(
        eq(schema.productionTasks.productId, productId),
        sql`${schema.productionTasks.status} IN ('pending', 'in_progress', 'paused')`
      ),
      orderBy: [
        desc(schema.productionTasks.priority),     // Сначала высокоприоритетные
        asc(schema.productionTasks.sortOrder),    // Потом по порядку выполнения
        asc(schema.productionTasks.createdAt)     // Затем по времени создания
      ],
      with: {
        order: true
      }
    });

    const completionDate = productionDate ? new Date(productionDate) : new Date();
    
    // Обработка случая когда нет активных заданий (WBS 2 - Adjustments Задача 4.4)
    if (activeTasks.length === 0) {
      const result = await db.transaction(async (tx) => {
        // Все произведенное количество добавляется на склад без заданий
        await tx.update(schema.stock)
          .set({
            currentStock: sql`${schema.stock.currentStock} + ${qualityQuantity}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, productId));

        // Логируем внеплановое производство
        if (qualityQuantity > 0) {
          await tx.insert(schema.stockMovements).values({
            productId: productId,
            movementType: 'incoming',
            quantity: qualityQuantity,
            referenceType: 'unplanned_production',
            comment: `Внеплановое производство - нет активных заданий`,
            userId
          });
        }

        return { 
          completedTasks: [],
          isUnplanned: true,
          totalProduced: producedQuantity,
          totalQuality: qualityQuantity
        };
      });

      res.json({
        success: true,
        data: result,
        message: `Произведено ${producedQuantity} шт. без заданий - добавлено на склад как внеплановое производство`
      });
      return;
    }

    const result = await db.transaction(async (tx) => {
      let remainingProduced = producedQuantity;
      let remainingQuality = qualityQuantity;
      let remainingSecondGrade = secondGradeQuantity;
      let remainingLibertyGrade = libertyGradeQuantity;
      let remainingDefect = defectQuantity;
      const completedTasks = [];
      const updatedOrders = new Set<number>();

      // Распределяем произведенное количество по заданиям
      for (const task of activeTasks) {
        if (remainingProduced <= 0) break;

        const taskNeeded = task.requestedQuantity;
        const taskProduced = Math.min(remainingProduced, taskNeeded);
        
        // Пропорционально распределяем качественные, второй сорт, Либерти и брак
        const taskQuality = Math.min(remainingQuality, Math.round((taskProduced / producedQuantity) * qualityQuantity));
        const taskSecondGrade = Math.min(remainingSecondGrade, Math.round((taskProduced / producedQuantity) * secondGradeQuantity));
        const taskLibertyGrade = Math.min(remainingLibertyGrade, Math.round((taskProduced / producedQuantity) * libertyGradeQuantity));
        const taskDefect = taskProduced - taskQuality - taskSecondGrade - taskLibertyGrade;

        // Обновляем задание
        const completedTask = await tx.update(schema.productionTasks)
          .set({
            status: 'completed',
            producedQuantity: taskProduced,
            qualityQuantity: taskQuality,
            secondGradeQuantity: taskSecondGrade,
            libertyGradeQuantity: taskLibertyGrade,
            defectQuantity: taskDefect,
            completedAt: completionDate,
            completedBy: userId,
            notes: notes ? `${task.notes || ''}\n${notes}`.trim() : task.notes,
            updatedAt: new Date()
          })
          .where(eq(schema.productionTasks.id, task.id))
          .returning();

        completedTasks.push(completedTask[0]);

        // Обновляем остатки
        remainingProduced -= taskProduced;
        remainingQuality -= taskQuality;
        remainingSecondGrade -= taskSecondGrade;
        remainingLibertyGrade -= taskLibertyGrade;
        remainingDefect -= taskDefect;

        // Добавляем товары на склад (только качественные)
        if (taskQuality > 0) {
          await tx.insert(schema.stockMovements).values({
            productId,
            movementType: 'incoming', // используем существующий тип
            quantity: taskQuality,
            referenceId: task.id,
            referenceType: 'production_task',
            comment: `Производство завершено. Задание #${task.id}${task.order ? `, заказ #${task.order.orderNumber}` : ''}`,
            userId
          });

          // Обновляем текущий остаток
          await tx.insert(schema.stock).values({
            productId,
            currentStock: taskQuality
          }).onConflictDoUpdate({
            target: schema.stock.productId,
            set: {
              currentStock: sql`${schema.stock.currentStock} + ${taskQuality}`,
              updatedAt: new Date()
            }
          });
        }

        // Добавляем товар второго сорта на склад
        if (taskSecondGrade > 0) {
          // Находим или создаем товар второго сорта
          let secondGradeProductId = null;
          const secondGradeProduct = await tx.query.products.findFirst({
            where: and(
              eq(schema.products.name, product.name),
              eq(schema.products.grade, 'grade_2'),
              eq(schema.products.isActive, true)
            )
          });

          if (secondGradeProduct) {
            secondGradeProductId = secondGradeProduct.id;
          } else {
            // Создаем новый товар второго сорта с полным артикулом
            const { generateArticle } = await import('../utils/articleGenerator');
            
            // Получаем связанные данные для генерации артикула
            const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
              product.surfaceIds && product.surfaceIds.length > 0 
                ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, product.surfaceIds) })
                : [],
              product.logoId 
                ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, product.logoId) })
                : null,
              product.materialId 
                ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, product.materialId) })
                : null,
              product.bottomTypeId 
                ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, product.bottomTypeId) })
                : null,
              product.puzzleTypeId 
                ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, product.puzzleTypeId) })
                : null
            ]);

            const secondGradeProductData = {
              name: product.name,
              dimensions: product.dimensions as { length?: number; width?: number; thickness?: number },
              surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
              logo: logo ? { name: logo.name } : undefined,
              material: material ? { name: material.name } : undefined,
              bottomType: bottomType ? { code: bottomType.code } : undefined,
              puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
              carpetEdgeType: product.carpetEdgeType || undefined,
              carpetEdgeSides: product.carpetEdgeSides || undefined,
              carpetEdgeStrength: product.carpetEdgeStrength || undefined,
              pressType: product.pressType || 'not_selected',
              borderType: product.borderType || 'without_border',
              grade: 'grade_2' as const
            };
            
            const secondGradeArticle = generateArticle(secondGradeProductData);

            const [newSecondGradeProduct] = await tx.insert(schema.products).values({
              name: product.name,
              article: secondGradeArticle,
              categoryId: product.categoryId,
              productType: product.productType,
              dimensions: product.dimensions,
              surfaceIds: product.surfaceIds,
              logoId: product.logoId,
              materialId: product.materialId,
              bottomTypeId: product.bottomTypeId,
              puzzleTypeId: product.puzzleTypeId,
              puzzleSides: product.puzzleSides,
              carpetEdgeType: product.carpetEdgeType,
              carpetEdgeSides: product.carpetEdgeSides,
              carpetEdgeStrength: product.carpetEdgeStrength,
              matArea: product.matArea,
              weight: product.weight,
              pressType: product.pressType,
              borderType: product.borderType,
              grade: 'grade_2',
              normStock: 0,
              isActive: true,
              notes: `Автоматически создан для 2-го сорта по заданию #${task.id}`
            }).returning();
            
            secondGradeProductId = newSecondGradeProduct.id;
          }

          // Обновляем остатки товара второго сорта
          await tx.insert(schema.stock).values({
            productId: secondGradeProductId,
            currentStock: taskSecondGrade
          }).onConflictDoUpdate({
            target: schema.stock.productId,
            set: {
              currentStock: sql`${schema.stock.currentStock} + ${taskSecondGrade}`,
              updatedAt: new Date()
            }
          });

          // Логируем движение товара
          await tx.insert(schema.stockMovements).values({
            productId: secondGradeProductId,
            movementType: 'incoming',
            quantity: taskSecondGrade,
            referenceId: task.id,
            referenceType: 'production_task',
            comment: `Производство 2-го сорта. Задание #${task.id}${task.order ? `, заказ #${task.order.orderNumber}` : ''}`,
            userId
          });
        }

        // Добавляем товар сорта Либерти на склад
        if (taskLibertyGrade > 0) {
          // Находим или создаем товар сорта Либерти
          let libertyGradeProductId = null;
          const libertyGradeProduct = await tx.query.products.findFirst({
            where: and(
              eq(schema.products.name, product.name),
              eq(schema.products.grade, 'liber'),
              eq(schema.products.isActive, true)
            )
          });

          if (libertyGradeProduct) {
            libertyGradeProductId = libertyGradeProduct.id;
          } else {
            // Создаем новый товар сорта Либерти с полным артикулом
            const { generateArticle } = await import('../utils/articleGenerator');
            
            // Получаем связанные данные для генерации артикула
            const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
              product.surfaceIds && product.surfaceIds.length > 0 
                ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, product.surfaceIds) })
                : [],
              product.logoId 
                ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, product.logoId) })
                : null,
              product.materialId 
                ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, product.materialId) })
                : null,
              product.bottomTypeId 
                ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, product.bottomTypeId) })
                : null,
              product.puzzleTypeId 
                ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, product.puzzleTypeId) })
                : null
            ]);

            const libertyGradeProductData = {
              name: product.name,
              dimensions: product.dimensions as { length?: number; width?: number; thickness?: number },
              surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
              logo: logo ? { name: logo.name } : undefined,
              material: material ? { name: material.name } : undefined,
              bottomType: bottomType ? { code: bottomType.code } : undefined,
              puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
              carpetEdgeType: product.carpetEdgeType || undefined,
              carpetEdgeSides: product.carpetEdgeSides || undefined,
              carpetEdgeStrength: product.carpetEdgeStrength || undefined,
              pressType: product.pressType || 'not_selected',
              borderType: product.borderType || 'without_border',
              grade: 'liber' as const
            };
            
            const libertyGradeArticle = generateArticle(libertyGradeProductData);

            const [newLibertyGradeProduct] = await tx.insert(schema.products).values({
              name: product.name,
              article: libertyGradeArticle,
              categoryId: product.categoryId,
              productType: product.productType,
              dimensions: product.dimensions,
              surfaceIds: product.surfaceIds,
              logoId: product.logoId,
              materialId: product.materialId,
              bottomTypeId: product.bottomTypeId,
              puzzleTypeId: product.puzzleTypeId,
              puzzleSides: product.puzzleSides,
              carpetEdgeType: product.carpetEdgeType,
              carpetEdgeSides: product.carpetEdgeSides,
              carpetEdgeStrength: product.carpetEdgeStrength,
              matArea: product.matArea,
              weight: product.weight,
              pressType: product.pressType,
              borderType: product.borderType,
              grade: 'liber',
              normStock: 0,
              isActive: true,
              notes: `Автоматически создан для сорта Либерти по заданию #${task.id}`
            }).returning();
            
            libertyGradeProductId = newLibertyGradeProduct.id;
          }

          // Обновляем остатки товара сорта Либерти
          await tx.insert(schema.stock).values({
            productId: libertyGradeProductId,
            currentStock: taskLibertyGrade
          }).onConflictDoUpdate({
            target: schema.stock.productId,
            set: {
              currentStock: sql`${schema.stock.currentStock} + ${taskLibertyGrade}`,
              updatedAt: new Date()
            }
          });

          // Логируем движение товара
          await tx.insert(schema.stockMovements).values({
            productId: libertyGradeProductId,
            movementType: 'incoming',
            quantity: taskLibertyGrade,
            referenceId: task.id,
            referenceType: 'production_task',
            comment: `Производство сорта Либерти. Задание #${task.id}${task.order ? `, заказ #${task.order.orderNumber}` : ''}`,
            userId
          });
        }

        // Отмечаем заказ для пересчета статуса
        if (task.orderId) {
          updatedOrders.add(task.orderId);
        }
      }

      // Если произведено больше чем нужно было - создаем движение склада на излишки
      if (remainingProduced > 0 && remainingQuality > 0) {
        await tx.insert(schema.stockMovements).values({
          productId,
          movementType: 'incoming', // используем существующий тип
          quantity: remainingQuality,
          referenceType: 'production_surplus',
          comment: `Дополнительное производство. Излишки: +${remainingProduced} шт.`,
          userId
        });

        // Обновляем текущий остаток
        await tx.insert(schema.stock).values({
          productId,
          currentStock: remainingQuality
        }).onConflictDoUpdate({
          target: schema.stock.productId,
          set: {
            currentStock: sql`${schema.stock.currentStock} + ${remainingQuality}`,
            updatedAt: new Date()
          }
        });
      }

      // Пересчитываем статусы заказов и отправляем уведомления
      for (const orderId of updatedOrders) {
        try {
          const { analyzeOrderAvailability, cancelUnnecessaryProductionTasks } = await import('../utils/orderStatusCalculator');
          const orderAnalysis = await analyzeOrderAvailability(orderId);
          
          await tx.update(schema.orders)
            .set({ 
              status: orderAnalysis.status as any,
              updatedAt: new Date()
            })
            .where(eq(schema.orders.id, orderId));

          // Отменяем ненужные производственные задания если все товары доступны
          const cancelled = await cancelUnnecessaryProductionTasks(orderId);
          if (cancelled.cancelled > 0) {
            await tx.insert(schema.orderMessages).values({
              orderId,
              userId,
              message: `🚫 Автоматически отменено ${cancelled.cancelled} ненужных производственных заданий - товары уже доступны`
            });
          }

          // Находим завершенные задания для этого заказа
          const orderCompletedTasks = completedTasks.filter(task => task.orderId === orderId);
          
          if (orderCompletedTasks.length > 0) {
            // Отправляем уведомления о завершенных заданиях
            for (const task of orderCompletedTasks) {
              // Получаем название продукта по productId
              const product = await tx.query.products.findFirst({
                where: eq(schema.products.id, productId)
              });
              const productName = product?.name || 'товар';
              
              await tx.insert(schema.orderMessages).values({
                orderId,
                userId,
                message: `📦 Задание на производство выполнено: "${productName}" произведено ${task.qualityQuantity} шт.`
              });
            }

            // Проверяем готовность заказа к отгрузке
            const allItemsAvailable = orderAnalysis.items.every(item => 
              item.available_quantity >= item.required_quantity
            );

            if (allItemsAvailable && orderAnalysis.status === 'confirmed') {
              await tx.insert(schema.orderMessages).values({
                orderId,
                userId,
                message: `✅ Заказ готов к отгрузке! Все товары в наличии на складе.`
              });
            }
          }
        } catch (error) {
          console.error(`Ошибка пересчета статуса заказа ${orderId}:`, error);
        }
      }

      return {
        completedTasks,
        totalProduced: producedQuantity,
        totalQuality: qualityQuantity,
        totalSecondGrade: secondGradeQuantity,
        totalLibertyGrade: libertyGradeQuantity,
        totalDefect: defectQuantity,
        tasksCompleted: completedTasks.length,
        surplus: remainingProduced,
        updatedOrders: Array.from(updatedOrders)
      };
    });

    // Распределяем новый товар между заказами
    try {
      const { distributeNewStockToOrders } = await import('../utils/stockDistribution');
      const distributionResult = await distributeNewStockToOrders(productId, qualityQuantity);
      
      if (distributionResult.distributed > 0) {
        console.log(`🎯 Распределено ${distributionResult.distributed} шт товара ${productId} между ${distributionResult.ordersUpdated.length} заказами`);
      }
    } catch (distributionError) {
      console.error('Ошибка распределения товара:', distributionError);
    }

    res.json({
      success: true,
      data: result,
      message: `Завершено ${result.tasksCompleted} заданий. Произведено: ${result.totalProduced} шт. (${result.totalQuality} годных${result.totalSecondGrade > 0 ? `, ${result.totalSecondGrade} 2-й сорт` : ''}${result.totalLibertyGrade > 0 ? `, ${result.totalLibertyGrade} Либерти` : ''}, ${result.totalDefect} брак)${result.surplus > 0 ? `. Излишки: ${result.surplus} шт.` : ''}`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/:id/start - Начать выполнение задания
router.post('/tasks/:id/start', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const userId = req.user!.id;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    if (task.status !== 'pending') {
      return next(createError('Можно начать только ожидающие задания', 400));
    }

    // Обновляем задание
    const updatedTask = await db.update(schema.productionTasks)
      .set({
        status: 'in_progress',
        startedBy: userId,
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.productionTasks.id, taskId))
      .returning();

    res.json({
      success: true,
      data: updatedTask[0],
      message: 'Задание запущено в производство'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/production/tasks/:id/status - Изменить статус задания
router.put('/tasks/:id/status', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { status } = req.body;
    const userId = req.user!.id;

    if (!status) {
      return next(createError('Статус обязателен', 400));
    }

    // Валидные статусы для производственных заданий
    const validStatuses = ['pending', 'in_progress', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return next(createError(`Недопустимый статус: ${status}. Допустимые: ${validStatuses.join(', ')}`, 400));
    }

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    const currentStatus = task.status || 'pending'; // default to pending if null

    // Нельзя изменить статус завершенного задания
    if (currentStatus === 'completed') {
      return next(createError('Нельзя изменить статус завершенного задания', 400));
    }

    // Валидные переходы статусов
    const validTransitions: Record<string, string[]> = {
      'pending': ['in_progress', 'cancelled'],
      'in_progress': ['paused', 'completed', 'cancelled'],
      'paused': ['in_progress', 'cancelled'],
      'cancelled': ['pending'] // Можно восстановить отмененное задание
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      return next(createError(`Невозможно изменить статус с '${currentStatus}' на '${status}'`, 400));
    }

    // Обновляем задание с учетом специальных полей для разных статусов
    const updateData: any = { status, updatedAt: new Date() };

    if (status === 'in_progress' && currentStatus !== 'paused') {
      // Запуск задания (не из паузы)
      updateData.startedBy = userId;
      updateData.startedAt = new Date();
    } else if (status === 'in_progress' && currentStatus === 'paused') {
      // Возобновление из паузы - не меняем startedBy и startedAt
    }

    const updatedTask = await db.update(schema.productionTasks)
      .set(updateData)
      .where(eq(schema.productionTasks.id, taskId))
      .returning();

    const statusMessages: Record<string, string> = {
      'pending': 'Задание возвращено в очередь',
      'in_progress': currentStatus === 'paused' ? 'Задание возобновлено' : 'Задание запущено в производство',
      'paused': 'Задание поставлено на паузу',
      'completed': 'Задание завершено',
      'cancelled': 'Задание отменено'
    };

    res.json({
      success: true,
      data: updatedTask[0],
      message: statusMessages[status] || 'Статус задания изменен'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/production/tasks/:id - Редактировать задание
router.put('/tasks/:id', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { 
      requestedQuantity, 
      priority, 
      notes, 
      assignedTo,
      qualityQuantity, // Поле для статистики прогресса без складских операций
      // Поля планирования
      plannedStartDate,
      plannedEndDate
    } = req.body;
    const userId = req.user!.id;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    // Можно редактировать задания в статусах pending, in_progress, paused
    const editableStatuses = ['pending', 'in_progress', 'paused'];
    if (!task.status || !editableStatuses.includes(task.status)) {
      return next(createError('Можно редактировать только ожидающие, выполняемые или приостановленные задания', 400));
    }

    // Валидация данных
    const updateData: any = { updatedAt: new Date() };

    if (requestedQuantity !== undefined) {
      if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
        return next(createError('Количество должно быть положительным целым числом', 400));
      }
      updateData.requestedQuantity = requestedQuantity;
    }

    if (priority !== undefined) {
      if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
        return next(createError('Приоритет должен быть от 1 до 5', 400));
      }
      updateData.priority = priority;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (assignedTo !== undefined) {
      if (assignedTo !== null) {
        // Проверяем существование пользователя только если assignedTo не null
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, assignedTo)
        });
        if (!user) {
          return next(createError('Пользователь не найден', 404));
        }
      }
      updateData.assignedTo = assignedTo; // Устанавливаем assignedTo (может быть null)
    }

    // Обработка поля прогресса без складских операций
    if (qualityQuantity !== undefined) {
      if (!Number.isInteger(qualityQuantity) || qualityQuantity < 0) {
        return next(createError('Прогресс должен быть неотрицательным целым числом', 400));
      }
      
      // Проверяем, что прогресс не превышает запрошенное количество
      const maxQuantity = task.requestedQuantity;
      if (qualityQuantity > maxQuantity) {
        return next(createError(`Прогресс не может превышать запрошенное количество (${maxQuantity} шт)`, 400));
      }
      
      updateData.qualityQuantity = qualityQuantity;
      
      console.log(`[DEBUG] Updating qualityQuantity for task ${taskId}: ${qualityQuantity}`);
      
      // Автоматически определяем статус задания
      const isCompleted = qualityQuantity >= task.requestedQuantity;
      if (isCompleted && task.status !== 'completed') {
        updateData.status = 'completed';
        updateData.completedAt = new Date();
        updateData.completedBy = userId;
      }
    }

    // Валидация и обновление полей планирования
    if (plannedStartDate !== undefined || plannedEndDate !== undefined) {
      const planningValidation = validateProductionPlanning({
        plannedStartDate,
        plannedEndDate
      });

      if (!planningValidation.valid) {
        return next(createError(planningValidation.error || 'Некорректные данные планирования', 400));
      }

      // Проверка перекрытий отключена - разрешены параллельные задания
    }

    if (plannedStartDate !== undefined) {
      updateData.plannedStartDate = plannedStartDate ? new Date(plannedStartDate) : null;
    }

    if (plannedEndDate !== undefined) {
      updateData.plannedEndDate = plannedEndDate ? new Date(plannedEndDate) : null;
    }

    // Обновляем задание
    console.log(`[DEBUG] Update data for task ${taskId}:`, updateData);
    const updatedTask = await db.update(schema.productionTasks)
      .set(updateData)
      .where(eq(schema.productionTasks.id, taskId))
      .returning();
    console.log(`[DEBUG] Updated task ${taskId}:`, updatedTask[0]);

    // Получаем полную информацию о задании
    const fullTask = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId),
      with: {
        order: {
          columns: {
            id: true,
            orderNumber: true,
            customerName: true
          }
        },
        product: {
          with: {
            category: true
          }
        },
        createdByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        assignedToUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        startedByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        completedByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });
    
    console.log(`[DEBUG] Full task ${taskId} after query:`, fullTask?.qualityQuantity);

    res.json({
      success: true,
      data: fullTask,
      message: 'Задание обновлено',
      debug: {
        updatedTask: updatedTask[0],
        qualityQuantityUpdated: qualityQuantity !== undefined
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/production/tasks/:id/order - Изменить порядок заданий (drag-and-drop)
router.put('/tasks/reorder', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { taskIds } = req.body; // массив ID в новом порядке

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return next(createError('Необходимо передать массив ID заданий', 400));
    }

    // Обновляем sortOrder для каждого задания
    const updates = taskIds.map((id, index) => 
      db.update(schema.productionTasks)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(schema.productionTasks.id, id))
    );

    await Promise.all(updates);

    res.json({
      success: true,
      message: 'Порядок заданий обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/bulk-register - Массовая регистрация выпуска продукции (WBS 2 - Adjustments Задача 4.2)
router.post('/tasks/bulk-register', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { items, productionDate, notes } = req.body;
    const userId = req.user!.id;

    console.log(`[BULK-REGISTER] Получен запрос с ${items?.length || 0} товарами`);
    console.log(`[BULK-REGISTER] Первый item:`, JSON.stringify(items?.[0], null, 2));

    // Валидация входных данных
    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(createError('Необходимо указать список товаров для регистрации', 400));
    }

    // Валидация каждого элемента
    for (const item of items) {
      if (!item.article || !item.producedQuantity || item.producedQuantity <= 0) {
        return next(createError('Каждый товар должен иметь артикул и положительное количество', 400));
      }
      const secondGrade = item.secondGradeQuantity || 0;
      const libertyGrade = item.libertyGradeQuantity || 0;
      if ((item.qualityQuantity || 0) + secondGrade + libertyGrade + (item.defectQuantity || 0) !== item.producedQuantity) {
        return next(createError(`Для товара ${item.article}: сумма годных, 2-го сорта, Либерти и брака должна равняться произведенному количеству`, 400));
      }
    }

    const completionDate = productionDate ? new Date(productionDate) : new Date();
    const results: Array<{
      article: string;
      status: 'success' | 'warning' | 'error';
      message: string;
      tasksCompleted?: number;
      overproduction?: number;
    }> = [];

    // Обрабатываем каждый товар в транзакции
    await db.transaction(async (tx) => {
      for (const item of items) {
        const { 
          article, 
          producedQuantity, 
          qualityQuantity = producedQuantity, 
          secondGradeQuantity = 0,
          libertyGradeQuantity = 0,
          defectQuantity = 0 
        } = item;
        
        console.log(`[BULK-REGISTER] Товар: ${article}, produced: ${producedQuantity}, quality: ${qualityQuantity}, 2сорт: ${secondGradeQuantity}, Либер: ${libertyGradeQuantity}, брак: ${defectQuantity}`);

        // Находим товар по артикулу
        const product = await tx.query.products.findFirst({
          where: eq(schema.products.article, article)
        });

        if (!product) {
          console.log(`[BULK-REGISTER] ❌ ОШИБКА: Товар с артикулом "${article}" не найден в БД`);
          results.push({
            article,
            status: 'error',
            message: `Товар с артикулом "${article}" не найден`
          });
          continue;
        }
        
        console.log(`[BULK-REGISTER] ✅ Товар найден: ${product.name} (ID: ${product.id})`);

        // Получаем активные задания для этого товара, отсортированные по приоритету (WBS 2 - Adjustments Задача 4.3)
        const activeTasks = await tx.query.productionTasks.findMany({
          where: and(
            eq(schema.productionTasks.productId, product.id),
            sql`${schema.productionTasks.status} IN ('pending', 'in_progress', 'paused')`
          ),
          with: {
            order: true
          }
        });

        // Интеллектуальная сортировка по приоритетам (WBS 2 - Adjustments Задача 4.3)
        activeTasks.sort((a, b) => {
          // 1. Задания с заказами клиентов (orderId) имеют приоритет над заданиями на пополнение склада
          const aHasOrder = !!a.orderId;
          const bHasOrder = !!b.orderId;
          
          if (aHasOrder && !bHasOrder) return -1; // a - заказ клиента, b - пополнение → a приоритетнее
          if (!aHasOrder && bHasOrder) return 1;  // b - заказ клиента, a - пополнение → b приоритетнее
          
          // 2. Если оба задания для заказов клиентов - сортируем по приоритету и дате заказа
          if (aHasOrder && bHasOrder) {
            // Сначала по приоритету заказа (urgent > high > normal > low)
            const priorityMap = { 'urgent': 4, 'high': 3, 'normal': 2, 'low': 1 };
            const aPriority = a.order?.priority ? priorityMap[a.order.priority] || 2 : 2;
            const bPriority = b.order?.priority ? priorityMap[b.order.priority] || 2 : 2;
            
            if (aPriority !== bPriority) {
              return bPriority - aPriority; // Высокий приоритет сначала
            }
            
            // Затем по дате доставки заказа (раньше - приоритетнее)
            let aDeliveryDate = Infinity;
            let bDeliveryDate = Infinity;
            
            if (a.order?.deliveryDate) {
              aDeliveryDate = new Date(a.order.deliveryDate.toString()).getTime();
            }
            if (b.order?.deliveryDate) {
              bDeliveryDate = new Date(b.order.deliveryDate.toString()).getTime();
            }
            
            if (aDeliveryDate !== bDeliveryDate) {
              return aDeliveryDate - bDeliveryDate;
            }
          }
          
          // 3. Если оба задания на пополнение склада - сортируем по плановой дате
          if (!aHasOrder && !bHasOrder) {
            let aPlannedDate = Infinity;
            let bPlannedDate = Infinity;
            
            if (a.plannedStartDate) {
              aPlannedDate = new Date(a.plannedStartDate.toString()).getTime();
            }
            if (b.plannedStartDate) {
              bPlannedDate = new Date(b.plannedStartDate.toString()).getTime();
            }
            
            if (aPlannedDate !== bPlannedDate) {
              return aPlannedDate - bPlannedDate; // Раньше - приоритетнее
            }
          }
          
          // 4. При равных условиях - сортируем по приоритету задания
          const aTaskPriority = a.priority || 1;
          const bTaskPriority = b.priority || 1;
          
          if (aTaskPriority !== bTaskPriority) {
            return bTaskPriority - aTaskPriority; // Высокий приоритет сначала
          }
          
          // 5. И наконец по порядку сортировки и дате создания
          const aSortOrder = a.sortOrder || 0;
          const bSortOrder = b.sortOrder || 0;
          
          if (aSortOrder !== bSortOrder) {
            return aSortOrder - bSortOrder;
          }
          
          // По дате создания
          const aCreatedAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreatedAt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          
          return aCreatedAt - bCreatedAt;
        });

        // Обработка случая когда нет активных заданий (WBS 2 - Adjustments Задача 4.4)
        let hasOverproduction = false;
        let remainingQuality = qualityQuantity;
        const completedTasks: any[] = [];
        
        if (activeTasks.length === 0) {
          // Все произведенное количество добавляется на склад без заданий
          await tx.update(schema.stock)
            .set({
              currentStock: sql`${schema.stock.currentStock} + ${qualityQuantity}`,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, product.id));

          // Логируем внеплановое производство
          if (qualityQuantity > 0) {
            await tx.insert(schema.stockMovements).values({
              productId: product.id,
              movementType: 'incoming',
              quantity: qualityQuantity,
              referenceType: 'unplanned_production',
              comment: `Внеплановое производство - нет активных заданий (артикул: ${article})`,
              userId
            });
          }
          
          remainingQuality = 0; // Все использовано
          hasOverproduction = true;
          // НЕ делаем continue - продолжаем обработку сортов!
        } else {
          // Распределяем произведенное количество по заданиям
          // Сначала закрываем задания качественными товарами, брак игнорируем
          remainingQuality = qualityQuantity;

        for (const task of activeTasks) {
          if (remainingQuality <= 0) break;

          const currentQuality = task.qualityQuantity || 0;
          const taskQualityNeeded = task.requestedQuantity - currentQuality;
          
          if (taskQualityNeeded <= 0) continue; // Задание уже выполнено

          // Даем ровно столько качественных, сколько нужно для закрытия задания
          const taskQualityToGive = Math.min(remainingQuality, taskQualityNeeded);

          // Обновляем задание
          const newTotalQuality = currentQuality + taskQualityToGive;
          const newTotalProduced = (task.producedQuantity || 0) + taskQualityToGive;
          
          // Определяем новый статус - готово только если качественных >= запрошенного
          const isCompleted = newTotalQuality >= task.requestedQuantity;
          const newStatus = isCompleted ? 'completed' : (task.status === 'pending' ? 'in_progress' : task.status);

          const updatedTask = await tx.update(schema.productionTasks)
            .set({
              status: newStatus,
              producedQuantity: newTotalProduced,
              qualityQuantity: newTotalQuality,
              // defectQuantity НЕ обновляем - брак игнорируем
              startedAt: task.startedAt || completionDate,
              startedBy: task.startedBy || userId,
              completedAt: isCompleted ? completionDate : task.completedAt,
              completedBy: isCompleted ? userId : task.completedBy,
              notes: notes ? `${task.notes || ''}\n${notes}`.trim() : task.notes,
              updatedAt: new Date()
            })
            .where(eq(schema.productionTasks.id, task.id))
            .returning();

          completedTasks.push(updatedTask[0]);

          // Обновляем остатки качественных товаров
          remainingQuality -= taskQualityToGive;

          // Логируем движение товара (только годные)
          if (taskQualityToGive > 0) {
            await tx.insert(schema.stockMovements).values({
              productId: product.id,
              movementType: 'incoming',
              quantity: taskQualityToGive,
              referenceId: task.id,
              referenceType: 'production_task',
              comment: `Массовая регистрация производства (задание #${task.id})`,
              userId
            });
          }
        }

          // Добавляем остаток качественных товаров на склад (если есть)
          if (remainingQuality > 0) {
            await tx.update(schema.stock)
              .set({
                currentStock: sql`${schema.stock.currentStock} + ${remainingQuality}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, product.id));

            // Логируем остаток качественных товаров
            await tx.insert(schema.stockMovements).values({
              productId: product.id,
              movementType: 'incoming',
              quantity: remainingQuality,
              referenceType: 'overproduction',
              comment: `Остаток качественных товаров (артикул: ${article})`,
              userId
            });
            hasOverproduction = true;
          }
        } // Закрываем else блок

        // Обрабатываем товар 2-го сорта (если есть)
        console.log(`[BULK-REGISTER] ПРОВЕРКА 2-го сорта: secondGradeQuantity = ${secondGradeQuantity}, тип: ${typeof secondGradeQuantity}, условие !== 0: ${secondGradeQuantity !== 0}`);
        if (secondGradeQuantity !== 0) {
          console.log(`[BULK-REGISTER] Обработка 2-го сорта для ${article}, количество: ${secondGradeQuantity}, product.name: ${product.name}`);
          
          // Находим или создаем товар 2-го сорта с теми же характеристиками
          let secondGradeProduct = await tx.query.products.findFirst({
            where: and(
              // Основные параметры
              product.categoryId ? eq(schema.products.categoryId, product.categoryId) : undefined,
              eq(schema.products.name, product.name),
              eq(schema.products.productType, product.productType),
              eq(schema.products.grade, 'grade_2'),
              eq(schema.products.isActive, true),
              
              // Размеры
              product.dimensions ? eq(schema.products.dimensions, product.dimensions) : undefined,
              
              // Поверхности
              product.surfaceIds ? eq(schema.products.surfaceIds, product.surfaceIds) : undefined,
              
              // Логотип
              product.logoId ? eq(schema.products.logoId, product.logoId) : 
              (!product.logoId ? isNull(schema.products.logoId) : undefined),
              
              // Материал
              product.materialId ? eq(schema.products.materialId, product.materialId) : 
              (!product.materialId ? isNull(schema.products.materialId) : undefined),
              
              // Низ ковра
              product.bottomTypeId ? eq(schema.products.bottomTypeId, product.bottomTypeId) : 
              (!product.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
              
              // Паззл
              product.puzzleTypeId ? eq(schema.products.puzzleTypeId, product.puzzleTypeId) : 
              (!product.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
              
              product.puzzleSides ? eq(schema.products.puzzleSides, product.puzzleSides) : undefined,
              
              // Пресс
              product.pressType ? eq(schema.products.pressType, product.pressType) : 
              (!product.pressType ? isNull(schema.products.pressType) : undefined),
              
              // Края ковра
              product.carpetEdgeType ? eq(schema.products.carpetEdgeType, product.carpetEdgeType) : 
              (!product.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
              
              product.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, product.carpetEdgeSides) : undefined,
              
              product.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, product.carpetEdgeStrength) : 
              (!product.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
              
              // Площадь мата
              product.matArea ? eq(schema.products.matArea, product.matArea) : 
              (!product.matArea ? isNull(schema.products.matArea) : undefined),
              
              // Вес
              product.weight ? eq(schema.products.weight, product.weight) : 
              (!product.weight ? isNull(schema.products.weight) : undefined),
              
              // Борт
              product.borderType ? eq(schema.products.borderType, product.borderType) : 
              (!product.borderType ? isNull(schema.products.borderType) : undefined)
            )
          });

          console.log(`[BULK-REGISTER] Товар 2-го сорта ${secondGradeProduct ? 'найден' : 'НЕ найден'}, будет создан: ${!secondGradeProduct}`);

          if (!secondGradeProduct) {
            console.log(`[BULK-REGISTER] Создание нового товара 2-го сорта для ${product.name}`);
            // Создаем новый товар 2-го сорта с полным артикулом
            const { generateArticle } = await import('../utils/articleGenerator');
            
            // Получаем связанные данные для генерации артикула
            const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
              product.surfaceIds && product.surfaceIds.length > 0 
                ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, product.surfaceIds) })
                : [],
              product.logoId 
                ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, product.logoId) })
                : null,
              product.materialId 
                ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, product.materialId) })
                : null,
              product.bottomTypeId 
                ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, product.bottomTypeId) })
                : null,
              product.puzzleTypeId 
                ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, product.puzzleTypeId) })
                : null
            ]);

            const secondGradeProductData = {
              name: product.name,
              dimensions: product.dimensions as { length?: number; width?: number; thickness?: number },
              surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
              logo: logo ? { name: logo.name } : undefined,
              material: material ? { name: material.name } : undefined,
              bottomType: bottomType ? { code: bottomType.code } : undefined,
              puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
              carpetEdgeType: product.carpetEdgeType || undefined,
              carpetEdgeSides: product.carpetEdgeSides || undefined,
              carpetEdgeStrength: product.carpetEdgeStrength || undefined,
              pressType: product.pressType || 'not_selected',
              borderType: product.borderType || 'without_border',
              grade: 'grade_2' as const
            };
            
            const secondGradeArticle = generateArticle(secondGradeProductData);
            
            const [newSecondGradeProduct] = await tx.insert(schema.products).values({
              name: product.name,
              article: secondGradeArticle,
              categoryId: product.categoryId,
              productType: product.productType,
              dimensions: product.dimensions,
              surfaceIds: product.surfaceIds,
              logoId: product.logoId,
              materialId: product.materialId,
              bottomTypeId: product.bottomTypeId,
              puzzleTypeId: product.puzzleTypeId,
              puzzleSides: product.puzzleSides,
              carpetEdgeType: product.carpetEdgeType,
              carpetEdgeSides: product.carpetEdgeSides,
              carpetEdgeStrength: product.carpetEdgeStrength,
              matArea: product.matArea,
              weight: product.weight,
              pressType: product.pressType,
              borderType: product.borderType,
              grade: 'grade_2',
              normStock: 0,
              isActive: true,
              notes: `Автоматически создан для 2-го сорта из массовой регистрации (артикул: ${article})`
            }).returning();

            // Создаем запись остатков для нового товара
            await tx.insert(schema.stock).values({
              productId: newSecondGradeProduct.id,
              currentStock: 0,
              reservedStock: 0,
              updatedAt: new Date()
            });

            console.log(`[BULK-REGISTER] Товар 2-го сорта создан: ${newSecondGradeProduct.article} (ID: ${newSecondGradeProduct.id})`);
            secondGradeProduct = newSecondGradeProduct;
          } else if (secondGradeProduct) {
            console.log(`[BULK-REGISTER] Товар 2-го сорта уже существует: ${secondGradeProduct.article} (ID: ${secondGradeProduct.id})`);
            // Проверяем, есть ли запись в stock для существующего товара
            const existingStock = await tx.query.stock.findFirst({
              where: eq(schema.stock.productId, secondGradeProduct.id)
            });

            if (!existingStock) {
              console.log(`[BULK-REGISTER] Создание записи stock для существующего товара 2-го сорта`);
              // Создаем запись остатков для существующего товара
              await tx.insert(schema.stock).values({
                productId: secondGradeProduct.id,
                currentStock: 0,
                reservedStock: 0,
                updatedAt: new Date()
              });
            }
          }

          if (secondGradeProduct) {
            console.log(`[BULK-REGISTER] Обновление остатков 2-го сорта: +${secondGradeQuantity}`);
            // Обновляем остатки
            await tx.update(schema.stock)
              .set({
                currentStock: sql`current_stock + ${secondGradeQuantity}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, secondGradeProduct.id));

            // Логируем движение товара 2-го сорта
            await tx.insert(schema.stockMovements).values({
              productId: secondGradeProduct.id,
              movementType: secondGradeQuantity > 0 ? 'incoming' : 'outgoing',
              quantity: Math.abs(secondGradeQuantity),
              referenceType: 'production',
              comment: `2-й сорт из массовой регистрации (артикул: ${article})`,
              userId
            });
            console.log(`[BULK-REGISTER] Остатки 2-го сорта обновлены успешно`);
          } else {
            console.log(`[BULK-REGISTER] ВНИМАНИЕ: Товар 2-го сорта не был создан и не найден`);
          }
        }

        // Обрабатываем товар сорта Либерти (если есть)
        console.log(`[BULK-REGISTER] ПРОВЕРКА Либерти: libertyGradeQuantity = ${libertyGradeQuantity}, тип: ${typeof libertyGradeQuantity}, условие !== 0: ${libertyGradeQuantity !== 0}`);
        if (libertyGradeQuantity !== 0) {
          console.log(`[BULK-REGISTER] Обработка Либерти для ${article}, количество: ${libertyGradeQuantity}, product.name: ${product.name}`);
          
          // Находим или создаем товар сорта Либерти с теми же характеристиками
          let libertyGradeProduct = await tx.query.products.findFirst({
            where: and(
              // Основные параметры
              product.categoryId ? eq(schema.products.categoryId, product.categoryId) : undefined,
              eq(schema.products.name, product.name),
              eq(schema.products.productType, product.productType),
              eq(schema.products.grade, 'liber'),
              eq(schema.products.isActive, true),
              
              // Размеры
              product.dimensions ? eq(schema.products.dimensions, product.dimensions) : undefined,
              
              // Поверхности
              product.surfaceIds ? eq(schema.products.surfaceIds, product.surfaceIds) : undefined,
              
              // Логотип
              product.logoId ? eq(schema.products.logoId, product.logoId) : 
              (!product.logoId ? isNull(schema.products.logoId) : undefined),
              
              // Материал
              product.materialId ? eq(schema.products.materialId, product.materialId) : 
              (!product.materialId ? isNull(schema.products.materialId) : undefined),
              
              // Низ ковра
              product.bottomTypeId ? eq(schema.products.bottomTypeId, product.bottomTypeId) : 
              (!product.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
              
              // Паззл
              product.puzzleTypeId ? eq(schema.products.puzzleTypeId, product.puzzleTypeId) : 
              (!product.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
              
              product.puzzleSides ? eq(schema.products.puzzleSides, product.puzzleSides) : undefined,
              
              // Пресс
              product.pressType ? eq(schema.products.pressType, product.pressType) : 
              (!product.pressType ? isNull(schema.products.pressType) : undefined),
              
              // Края ковра
              product.carpetEdgeType ? eq(schema.products.carpetEdgeType, product.carpetEdgeType) : 
              (!product.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
              
              product.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, product.carpetEdgeSides) : undefined,
              
              product.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, product.carpetEdgeStrength) : 
              (!product.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
              
              // Площадь мата
              product.matArea ? eq(schema.products.matArea, product.matArea) : 
              (!product.matArea ? isNull(schema.products.matArea) : undefined),
              
              // Вес
              product.weight ? eq(schema.products.weight, product.weight) : 
              (!product.weight ? isNull(schema.products.weight) : undefined),
              
              // Борт
              product.borderType ? eq(schema.products.borderType, product.borderType) : 
              (!product.borderType ? isNull(schema.products.borderType) : undefined)
            )
          });

          console.log(`[BULK-REGISTER] Товар Либерти ${libertyGradeProduct ? 'найден' : 'НЕ найден'}, будет создан: ${!libertyGradeProduct}`);

          if (!libertyGradeProduct) {
            console.log(`[BULK-REGISTER] Создание нового товара Либерти для ${product.name}`);
            // Создаем новый товар сорта Либерти с полным артикулом
            const { generateArticle } = await import('../utils/articleGenerator');
            
            // Получаем связанные данные для генерации артикула
            const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
              product.surfaceIds && product.surfaceIds.length > 0 
                ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, product.surfaceIds) })
                : [],
              product.logoId 
                ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, product.logoId) })
                : null,
              product.materialId 
                ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, product.materialId) })
                : null,
              product.bottomTypeId 
                ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, product.bottomTypeId) })
                : null,
              product.puzzleTypeId 
                ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, product.puzzleTypeId) })
                : null
            ]);

            const libertyGradeProductData = {
              name: product.name,
              dimensions: product.dimensions as { length?: number; width?: number; thickness?: number },
              surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
              logo: logo ? { name: logo.name } : undefined,
              material: material ? { name: material.name } : undefined,
              bottomType: bottomType ? { code: bottomType.code } : undefined,
              puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
              carpetEdgeType: product.carpetEdgeType || undefined,
              carpetEdgeSides: product.carpetEdgeSides || undefined,
              carpetEdgeStrength: product.carpetEdgeStrength || undefined,
              pressType: product.pressType || 'not_selected',
              borderType: product.borderType || 'without_border',
              grade: 'liber' as const
            };
            
            const libertyGradeArticle = generateArticle(libertyGradeProductData);
            
            const [newLibertyGradeProduct] = await tx.insert(schema.products).values({
              name: product.name,
              article: libertyGradeArticle,
              categoryId: product.categoryId,
              productType: product.productType,
              dimensions: product.dimensions,
              surfaceIds: product.surfaceIds,
              logoId: product.logoId,
              materialId: product.materialId,
              bottomTypeId: product.bottomTypeId,
              puzzleTypeId: product.puzzleTypeId,
              puzzleSides: product.puzzleSides,
              carpetEdgeType: product.carpetEdgeType,
              carpetEdgeSides: product.carpetEdgeSides,
              carpetEdgeStrength: product.carpetEdgeStrength,
              matArea: product.matArea,
              weight: product.weight,
              pressType: product.pressType,
              borderType: product.borderType,
              grade: 'liber',
              normStock: 0,
              isActive: true,
              notes: `Автоматически создан для сорта Либерти из массовой регистрации (артикул: ${article})`
            }).returning();

            // Создаем запись остатков для нового товара
            await tx.insert(schema.stock).values({
              productId: newLibertyGradeProduct.id,
              currentStock: 0,
              reservedStock: 0,
              updatedAt: new Date()
            });

            console.log(`[BULK-REGISTER] Товар Либерти создан: ${newLibertyGradeProduct.article} (ID: ${newLibertyGradeProduct.id})`);
            libertyGradeProduct = newLibertyGradeProduct;
          } else if (libertyGradeProduct) {
            console.log(`[BULK-REGISTER] Товар Либерти уже существует: ${libertyGradeProduct.article} (ID: ${libertyGradeProduct.id})`);
            // Проверяем, есть ли запись в stock для существующего товара
            const existingStock = await tx.query.stock.findFirst({
              where: eq(schema.stock.productId, libertyGradeProduct.id)
            });

            if (!existingStock) {
              console.log(`[BULK-REGISTER] Создание записи stock для существующего товара Либерти`);
              // Создаем запись остатков для существующего товара
              await tx.insert(schema.stock).values({
                productId: libertyGradeProduct.id,
                currentStock: 0,
                reservedStock: 0,
                updatedAt: new Date()
              });
            }
          }

          if (libertyGradeProduct) {
            console.log(`[BULK-REGISTER] Обновление остатков Либерти: +${libertyGradeQuantity}`);
            // Обновляем остатки
            await tx.update(schema.stock)
              .set({
                currentStock: sql`current_stock + ${libertyGradeQuantity}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, libertyGradeProduct.id));

            // Логируем движение товара сорта Либерти
            await tx.insert(schema.stockMovements).values({
              productId: libertyGradeProduct.id,
              movementType: libertyGradeQuantity > 0 ? 'incoming' : 'outgoing',
              quantity: Math.abs(libertyGradeQuantity),
              referenceType: 'production',
              comment: `Либерти из массовой регистрации (артикул: ${article})`,
              userId
            });
            console.log(`[BULK-REGISTER] Остатки Либерти обновлены успешно`);
          } else {
            console.log(`[BULK-REGISTER] ВНИМАНИЕ: Товар Либерти не был создан и не найден`);
          }
        }

        // Брак НЕ добавляется на склад - только учитывается в статистике заданий

        // Определяем статус результата
        const totalDistributed = qualityQuantity - remainingQuality;
        hasOverproduction = hasOverproduction || remainingQuality > 0;
        const hasDefect = defectQuantity > 0;

        let resultMessage = activeTasks.length > 0 
          ? `Распределено ${totalDistributed} шт. качественных товаров между ${completedTasks.length} заданиями`
          : `Произведено ${producedQuantity} шт. без заданий - добавлено на склад как внеплановое производство`;
        
        if (hasOverproduction && remainingQuality > 0) {
          resultMessage += `. Остаток: ${remainingQuality} шт. качественных`;
        }
        if (hasDefect) {
          resultMessage += `. Брак: ${defectQuantity} шт.`;
        }

        results.push({
          article,
          status: hasOverproduction || hasDefect ? 'warning' : 'success',
          message: resultMessage,
          tasksCompleted: completedTasks.length,
          overproduction: remainingQuality
        });
      }
    });

    console.log(`[BULK-REGISTER] ✅ Транзакция завершена успешно. Обработано товаров: ${items.length}, результатов: ${results.length}`);

    res.json({
      success: true,
      data: results,
      message: `Обработано ${items.length} позиций товаров`
    });

  } catch (error) {
    console.error(`[BULK-REGISTER] ❌ КРИТИЧЕСКАЯ ОШИБКА:`, error);
    next(error);
  }
});

// POST /api/production/tasks/:id/partial-complete - Частичное выполнение задания (WBS 2 - Adjustments Задача 4.1)
router.post('/tasks/:id/partial-complete', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { 
      producedQuantity: rawProducedQuantity, 
      qualityQuantity: rawQualityQuantity,
      secondGradeQuantity: rawSecondGradeQuantity = 0,
      libertyGradeQuantity: rawLibertyGradeQuantity = 0,
      defectQuantity: rawDefectQuantity, 
      notes 
    } = req.body;
    
    // Явное приведение к числам
    const producedQuantity = Number(rawProducedQuantity) || 0;
    const qualityQuantity = Number(rawQualityQuantity) || 0;
    const secondGradeQuantity = Number(rawSecondGradeQuantity) || 0;
    const libertyGradeQuantity = Number(rawLibertyGradeQuantity) || 0;
    const defectQuantity = Number(rawDefectQuantity) || 0;
    
    const userId = req.user!.id;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId),
      with: {
        product: true,
        order: true
      }
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    if (task.status !== 'pending' && task.status !== 'in_progress') {
      return next(createError('Можно регистрировать выпуск только для активных заданий', 400));
    }

    // Валидация - разрешаем отрицательные значения для корректировки
    // Убрали блокировку отрицательных значений для qualityQuantity и defectQuantity

    // Проверка корректировки (отрицательные значения)
    if (producedQuantity < 0) {
      const currentProduced = task.producedQuantity || 0;
      if (currentProduced + producedQuantity < 0) {
        return next(createError(
          `Недостаточно продукции для корректировки. Доступно: ${currentProduced} шт, пытаетесь убрать: ${Math.abs(producedQuantity)} шт`, 
          400
        ));
      }
    }

    // Валидация суммы
    const totalSum = qualityQuantity + secondGradeQuantity + libertyGradeQuantity + defectQuantity;
    if (totalSum !== producedQuantity) {
      return next(createError(
        `Сумма годных (${qualityQuantity}), 2-го сорта (${secondGradeQuantity}), Либерти (${libertyGradeQuantity}) и брака (${defectQuantity}) = ${totalSum} должна равняться произведенному количеству (${producedQuantity})`, 
        400
      ));
    }

    // Обработка сверхпланового производства (исправленная логика)
    const currentProduced = task.producedQuantity || 0;
    const currentQuality = task.qualityQuantity || 0;
    const remainingNeeded = Math.max(0, task.requestedQuantity - currentQuality); // остается качественного для закрытия задания
    
    // Определяем сколько качественной продукции пойдет на закрытие задания
    const taskQualityQuantity = Math.min(qualityQuantity, remainingNeeded);
    
    // Сверхплановое качественное производство (если есть)
    const overproductionQuality = Math.max(0, qualityQuantity - taskQualityQuantity);
    
    // Весь брак считается сверхплановым (не засчитывается в выполнение задания)
    const taskDefectQuantity = 0;
    
    // Общее сверхплановое количество = сверхплановые качественные + весь брак
    const overproductionQuantity = overproductionQuality + defectQuantity;
    
    // Обновляем общее количество БЕЗ ограничений - отражаем фактически произведенное
    const newTotalProduced = currentProduced + producedQuantity;

    // Обработка отрицательных значений (корректировка)
    if (producedQuantity < 0) {
      const quantityToRemove = Math.abs(producedQuantity);
      
      // Проверяем достаточность на складе
      const stockInfo = await getStockInfo(task.productId);
      if (stockInfo.currentStock < quantityToRemove) {
        return next(createError(
          `Недостаточно товара на складе для корректировки. На складе: ${stockInfo.currentStock} шт, требуется убрать: ${quantityToRemove} шт`, 
          400
        ));
      }
    }

    // Используем транзакцию для атомарности операций
    const result = await db.transaction(async (tx) => {
      // Обновляем счетчики задания
      const newQualityQuantity = (task.qualityQuantity || 0) + qualityQuantity; // записываем ВСЕ качественное количество
      const newSecondGradeQuantity = (task.secondGradeQuantity || 0) + secondGradeQuantity; // 2-й сорт
      const newLibertyGradeQuantity = (task.libertyGradeQuantity || 0) + libertyGradeQuantity; // Либерти
      const newDefectQuantity = (task.defectQuantity || 0) + defectQuantity; // весь брак записываем в задание
      
      // Проверяем, что итоговые значения не станут отрицательными
      if (newQualityQuantity < 0) {
        return next(createError(
          `Недостаточно качественной продукции в задании для корректировки. Доступно: ${task.qualityQuantity || 0} шт, пытаетесь убрать: ${Math.abs(qualityQuantity)} шт`, 
          400
        ));
      }
      if (newSecondGradeQuantity < 0) {
        return next(createError(
          `Недостаточно продукции 2-го сорта в задании для корректировки. Доступно: ${task.secondGradeQuantity || 0} шт, пытаетесь убрать: ${Math.abs(secondGradeQuantity)} шт`, 
          400
        ));
      }
      if (newLibertyGradeQuantity < 0) {
        return next(createError(
          `Недостаточно продукции сорта Либерти в задании для корректировки. Доступно: ${task.libertyGradeQuantity || 0} шт, пытаетесь убрать: ${Math.abs(libertyGradeQuantity)} шт`, 
          400
        ));
      }
      if (newDefectQuantity < 0) {
        return next(createError(
          `Недостаточно бракованной продукции в задании для корректировки. Доступно: ${task.defectQuantity || 0} шт, пытаетесь убрать: ${Math.abs(defectQuantity)} шт`, 
          400
        ));
      }
      
      // Определяем новый статус - готово только если качественных >= запрошенного
      const isCompleted = newQualityQuantity >= task.requestedQuantity;
      const newStatus = isCompleted ? 'completed' : (task.status === 'pending' ? 'in_progress' : task.status);
      
      const updatedTask = await tx.update(schema.productionTasks)
        .set({
          status: newStatus,
          producedQuantity: newTotalProduced,
          qualityQuantity: newQualityQuantity,
          secondGradeQuantity: newSecondGradeQuantity,
          libertyGradeQuantity: newLibertyGradeQuantity,
          defectQuantity: newDefectQuantity,
          startedAt: task.startedAt || new Date(), // Автоматически запускаем если еще не запущено
          startedBy: task.startedBy || userId,
          completedAt: isCompleted ? new Date() : task.completedAt,
          completedBy: isCompleted ? userId : task.completedBy,
          notes: notes ? `${task.notes || ''}\n${notes}`.trim() : task.notes,
          updatedAt: new Date()
        })
        .where(eq(schema.productionTasks.id, taskId))
        .returning();

      // Обрабатываем складские операции
      if (producedQuantity > 0) {
        // Положительное количество - добавляем на склад
        if (qualityQuantity > 0) {
          await tx.update(schema.stock)
            .set({
              currentStock: sql`${schema.stock.currentStock} + ${qualityQuantity}`,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, task.productId));

          // Логируем движение товара от задания (только то что идет на выполнение плана)
          if (taskQualityQuantity > 0) {
            await tx.insert(schema.stockMovements).values({
              productId: task.productId,
              movementType: 'incoming',
              quantity: taskQualityQuantity,
              referenceId: taskId,
              referenceType: 'production_task',
              comment: `Производство по заданию #${taskId}${isCompleted ? ' (завершено)' : ''}`,
              userId
            });
          }
          
          // Логируем сверхплановое производство отдельно
          if (overproductionQuality > 0) {
            await tx.insert(schema.stockMovements).values({
              productId: task.productId,
              movementType: 'incoming',
              quantity: overproductionQuality,
              referenceId: taskId,
              referenceType: 'overproduction',
              comment: `Сверхплановое производство (задание #${taskId})`,
              userId
            });
          }
        }

        // Обрабатываем товар 2-го сорта (если есть)
        if (secondGradeQuantity !== 0) {
          // Находим товар 2-го сорта с теми же характеристиками (полный поиск)
          let secondGradeProduct = await tx.query.products.findFirst({
            where: and(
              task.product.categoryId ? eq(schema.products.categoryId, task.product.categoryId) : undefined,
              eq(schema.products.name, task.product.name),
              eq(schema.products.productType, task.product.productType),
              eq(schema.products.grade, 'grade_2'),
              eq(schema.products.isActive, true),
              task.product.dimensions ? eq(schema.products.dimensions, task.product.dimensions) : undefined,
              task.product.surfaceIds ? eq(schema.products.surfaceIds, task.product.surfaceIds) : undefined,
              task.product.logoId ? eq(schema.products.logoId, task.product.logoId) : (!task.product.logoId ? isNull(schema.products.logoId) : undefined),
              task.product.materialId ? eq(schema.products.materialId, task.product.materialId) : (!task.product.materialId ? isNull(schema.products.materialId) : undefined),
              task.product.bottomTypeId ? eq(schema.products.bottomTypeId, task.product.bottomTypeId) : (!task.product.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
              task.product.puzzleTypeId ? eq(schema.products.puzzleTypeId, task.product.puzzleTypeId) : (!task.product.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
              task.product.puzzleSides ? eq(schema.products.puzzleSides, task.product.puzzleSides) : undefined,
              task.product.pressType ? eq(schema.products.pressType, task.product.pressType) : (!task.product.pressType ? isNull(schema.products.pressType) : undefined),
              task.product.carpetEdgeType ? eq(schema.products.carpetEdgeType, task.product.carpetEdgeType) : (!task.product.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
              task.product.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, task.product.carpetEdgeSides) : undefined,
              task.product.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, task.product.carpetEdgeStrength) : (!task.product.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
              task.product.matArea ? eq(schema.products.matArea, task.product.matArea) : (!task.product.matArea ? isNull(schema.products.matArea) : undefined),
              task.product.weight ? eq(schema.products.weight, task.product.weight) : (!task.product.weight ? isNull(schema.products.weight) : undefined),
              task.product.borderType ? eq(schema.products.borderType, task.product.borderType) : (!task.product.borderType ? isNull(schema.products.borderType) : undefined)
            )
          });

          if (!secondGradeProduct) {
            // Создаем новый товар 2-го сорта с полным артикулом (независимо от quantity - может быть отрицательным)
            const { generateArticle } = await import('../utils/articleGenerator');
            
            // Получаем связанные данные для генерации артикула
            const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
              task.product.surfaceIds && task.product.surfaceIds.length > 0 
                ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, task.product.surfaceIds) })
                : [],
              task.product.logoId 
                ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, task.product.logoId) })
                : null,
              task.product.materialId 
                ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, task.product.materialId) })
                : null,
              task.product.bottomTypeId 
                ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, task.product.bottomTypeId) })
                : null,
              task.product.puzzleTypeId 
                ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, task.product.puzzleTypeId) })
                : null
            ]);

            const secondGradeProductData = {
              name: task.product.name,
              dimensions: task.product.dimensions as { length?: number; width?: number; thickness?: number },
              surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
              logo: logo ? { name: logo.name } : undefined,
              material: material ? { name: material.name } : undefined,
              bottomType: bottomType ? { code: bottomType.code } : undefined,
              puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
              carpetEdgeType: task.product.carpetEdgeType || undefined,
              carpetEdgeSides: task.product.carpetEdgeSides || undefined,
              carpetEdgeStrength: task.product.carpetEdgeStrength || undefined,
              pressType: task.product.pressType || 'not_selected',
              borderType: task.product.borderType || 'without_border',
              grade: 'grade_2' as const
            };
            
            const secondGradeArticle = generateArticle(secondGradeProductData);
            
            const [newSecondGradeProduct] = await tx.insert(schema.products).values({
              name: task.product.name,
              article: secondGradeArticle,
              categoryId: task.product.categoryId,
              productType: task.product.productType,
              dimensions: task.product.dimensions,
              surfaceIds: task.product.surfaceIds,
              logoId: task.product.logoId,
              materialId: task.product.materialId,
              bottomTypeId: task.product.bottomTypeId,
              puzzleTypeId: task.product.puzzleTypeId,
              puzzleSides: task.product.puzzleSides,
              carpetEdgeType: task.product.carpetEdgeType,
              carpetEdgeSides: task.product.carpetEdgeSides,
              carpetEdgeStrength: task.product.carpetEdgeStrength,
              matArea: task.product.matArea,
              weight: task.product.weight,
              pressType: task.product.pressType,
              borderType: task.product.borderType,
              grade: 'grade_2',
              normStock: 0,
              isActive: true,
              notes: `Автоматически создан для 2-го сорта по заданию #${taskId}`
            }).returning();

            // Создаем запись остатков для нового товара
            await tx.insert(schema.stock).values({
              productId: newSecondGradeProduct.id,
              currentStock: 0,
              reservedStock: 0,
              updatedAt: new Date()
            });

            secondGradeProduct = newSecondGradeProduct;
          } else if (secondGradeProduct) {
            // Проверяем, есть ли запись в stock для существующего товара
            const existingStock = await tx.query.stock.findFirst({
              where: eq(schema.stock.productId, secondGradeProduct.id)
            });

            if (!existingStock) {
              // Создаем запись остатков для существующего товара
              await tx.insert(schema.stock).values({
                productId: secondGradeProduct.id,
                currentStock: 0,
                reservedStock: 0,
                updatedAt: new Date()
              });
            }
          }

          if (secondGradeProduct) {
            // Для отрицательных значений проверяем достаточность остатков
            if (secondGradeQuantity < 0) {
              const stockInfo = await tx.query.stock.findFirst({
                where: eq(schema.stock.productId, secondGradeProduct.id)
              });
              const currentStock = stockInfo?.currentStock || 0;
              const quantityToRemove = Math.abs(secondGradeQuantity);
              if (currentStock < quantityToRemove) {
                throw new Error(`Недостаточно товара 2-го сорта на складе для корректировки. На складе: ${currentStock} шт, требуется убрать: ${quantityToRemove} шт`);
              }
            }
            
            // Обновляем остатки
            await tx.update(schema.stock)
              .set({
                currentStock: sql`current_stock + ${secondGradeQuantity}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, secondGradeProduct.id));

            // Логируем движение
            await tx.insert(schema.stockMovements).values({
              productId: secondGradeProduct.id,
              movementType: secondGradeQuantity > 0 ? 'incoming' : 'adjustment',
              quantity: Math.abs(secondGradeQuantity),
              referenceId: taskId,
              referenceType: 'production_task',
              comment: `${secondGradeQuantity > 0 ? 'Производство' : 'Корректировка'} 2-го сорта по заданию #${taskId}`,
              userId
            });
          }
        }

        // Обрабатываем товар сорта Либерти (если есть)
        if (libertyGradeQuantity !== 0) {
          // Находим товар сорта Либерти с теми же характеристиками (полный поиск)
          let libertyGradeProduct = await tx.query.products.findFirst({
            where: and(
              task.product.categoryId ? eq(schema.products.categoryId, task.product.categoryId) : undefined,
              eq(schema.products.name, task.product.name),
              eq(schema.products.productType, task.product.productType),
              eq(schema.products.grade, 'liber'),
              eq(schema.products.isActive, true),
              task.product.dimensions ? eq(schema.products.dimensions, task.product.dimensions) : undefined,
              task.product.surfaceIds ? eq(schema.products.surfaceIds, task.product.surfaceIds) : undefined,
              task.product.logoId ? eq(schema.products.logoId, task.product.logoId) : (!task.product.logoId ? isNull(schema.products.logoId) : undefined),
              task.product.materialId ? eq(schema.products.materialId, task.product.materialId) : (!task.product.materialId ? isNull(schema.products.materialId) : undefined),
              task.product.bottomTypeId ? eq(schema.products.bottomTypeId, task.product.bottomTypeId) : (!task.product.bottomTypeId ? isNull(schema.products.bottomTypeId) : undefined),
              task.product.puzzleTypeId ? eq(schema.products.puzzleTypeId, task.product.puzzleTypeId) : (!task.product.puzzleTypeId ? isNull(schema.products.puzzleTypeId) : undefined),
              task.product.puzzleSides ? eq(schema.products.puzzleSides, task.product.puzzleSides) : undefined,
              task.product.pressType ? eq(schema.products.pressType, task.product.pressType) : (!task.product.pressType ? isNull(schema.products.pressType) : undefined),
              task.product.carpetEdgeType ? eq(schema.products.carpetEdgeType, task.product.carpetEdgeType) : (!task.product.carpetEdgeType ? isNull(schema.products.carpetEdgeType) : undefined),
              task.product.carpetEdgeSides ? eq(schema.products.carpetEdgeSides, task.product.carpetEdgeSides) : undefined,
              task.product.carpetEdgeStrength ? eq(schema.products.carpetEdgeStrength, task.product.carpetEdgeStrength) : (!task.product.carpetEdgeStrength ? isNull(schema.products.carpetEdgeStrength) : undefined),
              task.product.matArea ? eq(schema.products.matArea, task.product.matArea) : (!task.product.matArea ? isNull(schema.products.matArea) : undefined),
              task.product.weight ? eq(schema.products.weight, task.product.weight) : (!task.product.weight ? isNull(schema.products.weight) : undefined),
              task.product.borderType ? eq(schema.products.borderType, task.product.borderType) : (!task.product.borderType ? isNull(schema.products.borderType) : undefined)
            )
          });

          if (!libertyGradeProduct) {
            // Создаем новый товар сорта Либерти с полным артикулом (независимо от quantity - может быть отрицательным)
            const { generateArticle } = await import('../utils/articleGenerator');
            
            // Получаем связанные данные для генерации артикула
            const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
              task.product.surfaceIds && task.product.surfaceIds.length > 0 
                ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, task.product.surfaceIds) })
                : [],
              task.product.logoId 
                ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, task.product.logoId) })
                : null,
              task.product.materialId 
                ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, task.product.materialId) })
                : null,
              task.product.bottomTypeId 
                ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, task.product.bottomTypeId) })
                : null,
              task.product.puzzleTypeId 
                ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, task.product.puzzleTypeId) })
                : null
            ]);

            const libertyGradeProductData = {
              name: task.product.name,
              dimensions: task.product.dimensions as { length?: number; width?: number; thickness?: number },
              surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
              logo: logo ? { name: logo.name } : undefined,
              material: material ? { name: material.name } : undefined,
              bottomType: bottomType ? { code: bottomType.code } : undefined,
              puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
              carpetEdgeType: task.product.carpetEdgeType || undefined,
              carpetEdgeSides: task.product.carpetEdgeSides || undefined,
              carpetEdgeStrength: task.product.carpetEdgeStrength || undefined,
              pressType: task.product.pressType || 'not_selected',
              borderType: task.product.borderType || 'without_border',
              grade: 'liber' as const
            };
            
            const libertyGradeArticle = generateArticle(libertyGradeProductData);
            
            const [newLibertyGradeProduct] = await tx.insert(schema.products).values({
              name: task.product.name,
              article: libertyGradeArticle,
              categoryId: task.product.categoryId,
              productType: task.product.productType,
              dimensions: task.product.dimensions,
              surfaceIds: task.product.surfaceIds,
              logoId: task.product.logoId,
              materialId: task.product.materialId,
              bottomTypeId: task.product.bottomTypeId,
              puzzleTypeId: task.product.puzzleTypeId,
              puzzleSides: task.product.puzzleSides,
              carpetEdgeType: task.product.carpetEdgeType,
              carpetEdgeSides: task.product.carpetEdgeSides,
              carpetEdgeStrength: task.product.carpetEdgeStrength,
              matArea: task.product.matArea,
              weight: task.product.weight,
              pressType: task.product.pressType,
              borderType: task.product.borderType,
              grade: 'liber',
              normStock: 0,
              isActive: true,
              notes: `Автоматически создан для сорта Либерти по заданию #${taskId}`
            }).returning();

            // Создаем запись остатков для нового товара
            await tx.insert(schema.stock).values({
              productId: newLibertyGradeProduct.id,
              currentStock: 0,
              reservedStock: 0,
              updatedAt: new Date()
            });

            libertyGradeProduct = newLibertyGradeProduct;
          } else if (libertyGradeProduct) {
            // Проверяем, есть ли запись в stock для существующего товара
            const existingStock = await tx.query.stock.findFirst({
              where: eq(schema.stock.productId, libertyGradeProduct.id)
            });

            if (!existingStock) {
              // Создаем запись остатков для существующего товара
              await tx.insert(schema.stock).values({
                productId: libertyGradeProduct.id,
                currentStock: 0,
                reservedStock: 0,
                updatedAt: new Date()
              });
            }
          }

          if (libertyGradeProduct) {
            // Для отрицательных значений проверяем достаточность остатков
            if (libertyGradeQuantity < 0) {
              const stockInfo = await tx.query.stock.findFirst({
                where: eq(schema.stock.productId, libertyGradeProduct.id)
              });
              const currentStock = stockInfo?.currentStock || 0;
              const quantityToRemove = Math.abs(libertyGradeQuantity);
              if (currentStock < quantityToRemove) {
                throw new Error(`Недостаточно товара сорта Либерти на складе для корректировки. На складе: ${currentStock} шт, требуется убрать: ${quantityToRemove} шт`);
              }
            }
            
            // Обновляем остатки
            await tx.update(schema.stock)
              .set({
                currentStock: sql`current_stock + ${libertyGradeQuantity}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, libertyGradeProduct.id));

            // Логируем движение
            await tx.insert(schema.stockMovements).values({
              productId: libertyGradeProduct.id,
              movementType: libertyGradeQuantity > 0 ? 'incoming' : 'adjustment',
              quantity: Math.abs(libertyGradeQuantity),
              referenceId: taskId,
              referenceType: 'production_task',
              comment: `${libertyGradeQuantity > 0 ? 'Производство' : 'Корректировка'} сорта Либерти по заданию #${taskId}`,
              userId
            });
          }
        }
      } else if (producedQuantity < 0) {
        // Отрицательное количество - убираем со склада используя существующую логику корректировки
        const quantityToRemove = Math.abs(producedQuantity);
        
        // Используем performStockOperation для корректировки
        await performStockOperation({
          productId: task.productId,
          type: 'adjustment',
          quantity: producedQuantity, // Отрицательное значение
          userId: userId,
          comment: `Корректировка задания #${taskId}: убрано ${quantityToRemove} шт`
        });
      }

      // Аудит лог
      await tx.insert(schema.auditLog).values({
        tableName: 'production_tasks',
        recordId: taskId,
        operation: 'UPDATE',
        oldValues: task,
        newValues: updatedTask[0],
        userId
      });

      return { 
        task: updatedTask[0], 
        wasCompleted: isCompleted,
        remainingQuantity: task.requestedQuantity - newTotalProduced,
        overproductionQuantity: overproductionQuantity,
        overproductionQuality: overproductionQuality
      };
    });

    let message = '';
    if (producedQuantity < 0) {
      // Корректировка
      const quantityRemoved = Math.abs(producedQuantity);
      message = `Корректировка: убрано ${quantityRemoved} шт из задания. Товар списан со склада.`;
      if (result && result.wasCompleted) {
        message += ` Задание завершено: ${newTotalProduced} из ${task.requestedQuantity} шт.`;
      } else {
        message += ` Осталось произвести: ${result?.remainingQuantity || 0} шт.`;
      }
    } else if (result && result.wasCompleted) {
      if (result.overproductionQuantity > 0) {
        message = `Задание завершено! Произведено ${newTotalProduced} из ${task.requestedQuantity} шт. + ${result.overproductionQuantity} шт. сверх плана`;
      } else {
        message = `Задание завершено! Произведено ${newTotalProduced} из ${task.requestedQuantity} шт.`;
      }
    } else {
      message = `Зарегистрировано ${producedQuantity} шт. Осталось произвести: ${result?.remainingQuantity || 0} шт.`;
      if (result && result.overproductionQuantity > 0) {
        message += ` + ${result.overproductionQuantity} шт. сверх плана`;
      }
    }

    res.json({
      success: true,
      data: result?.task || task,
      message: message
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/:id/complete - Завершить задание с указанием результатов
router.post('/tasks/:id/complete', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { 
      producedQuantity, 
      qualityQuantity, 
      secondGradeQuantity = 0,
      libertyGradeQuantity = 0,
      defectQuantity, 
      extraProducts = [],
      notes 
    } = req.body;
    const userId = req.user!.id;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId),
      with: {
        product: true,
        order: true
      }
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    if (task.status !== 'in_progress') {
      return next(createError('Можно завершить только задания в работе', 400));
    }

    // Валидация - разрешаем отрицательные значения для корректировки
    // Убрали блокировку отрицательных значений

    if (qualityQuantity + secondGradeQuantity + libertyGradeQuantity + defectQuantity !== producedQuantity) {
      return next(createError('Сумма годных, второго сорта, Либерти и брака должна равняться произведенному количеству', 400));
    }

    // Проверяем, что итоговые значения не станут отрицательными
    if (qualityQuantity < 0 && (task.qualityQuantity || 0) + qualityQuantity < 0) {
      return next(createError(
        `Недостаточно качественной продукции в задании для корректировки. Доступно: ${task.qualityQuantity || 0} шт, пытаетесь убрать: ${Math.abs(qualityQuantity)} шт`, 
        400
      ));
    }
    if (defectQuantity < 0 && (task.defectQuantity || 0) + defectQuantity < 0) {
      return next(createError(
        `Недостаточно бракованной продукции в задании для корректировки. Доступно: ${task.defectQuantity || 0} шт, пытаетесь убрать: ${Math.abs(defectQuantity)} шт`, 
        400
      ));
    }
    if (secondGradeQuantity < 0 && (task.secondGradeQuantity || 0) + secondGradeQuantity < 0) {
      return next(createError(
        `Недостаточно товара 2-го сорта в задании для корректировки. Доступно: ${task.secondGradeQuantity || 0} шт, пытаетесь убрать: ${Math.abs(secondGradeQuantity)} шт`, 
        400
      ));
    }
    if (libertyGradeQuantity < 0 && (task.libertyGradeQuantity || 0) + libertyGradeQuantity < 0) {
      return next(createError(
        `Недостаточно товара сорта Либерти в задании для корректировки. Доступно: ${task.libertyGradeQuantity || 0} шт, пытаетесь убрать: ${Math.abs(libertyGradeQuantity)} шт`, 
        400
      ));
    }

    // Используем транзакцию для атомарности операций
    const result = await db.transaction(async (tx) => {
      // Обновляем задание
      const updatedTask = await tx.update(schema.productionTasks)
        .set({
          status: 'completed',
          producedQuantity,
          qualityQuantity,
          secondGradeQuantity,
          libertyGradeQuantity,
          defectQuantity,
          completedBy: userId,
          completedAt: new Date(),
          notes: notes || task.notes,
          updatedAt: new Date()
        })
        .where(eq(schema.productionTasks.id, taskId))
        .returning();

      // Добавляем годные изделия на склад
      if (qualityQuantity > 0) {
        await tx.update(schema.stock)
          .set({
            currentStock: sql`${schema.stock.currentStock} + ${qualityQuantity}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, task.productId));

        // Логируем движение товара
        await tx.insert(schema.stockMovements).values({
          productId: task.productId,
          movementType: 'incoming',
          quantity: qualityQuantity,
          referenceId: taskId,
          referenceType: 'production_task',
          comment: `Производство завершено (задание #${taskId})`,
          userId
        });
      }

      // Обрабатываем товар второго сорта
      if (secondGradeQuantity !== 0) {
        // Находим или создаем товар второго сорта
        let secondGradeProductId = null;
        const secondGradeProduct = await tx.query.products.findFirst({
          where: and(
            eq(schema.products.name, task.product.name),
            eq(schema.products.grade, 'grade_2'),
            eq(schema.products.isActive, true)
          )
        });

        if (secondGradeProduct) {
          secondGradeProductId = secondGradeProduct.id;
        } else if (secondGradeQuantity !== 0) {
          // Создаем новый товар второго сорта с полным артикулом
          const { generateArticle } = await import('../utils/articleGenerator');
          
          // Получаем связанные данные для генерации артикула
          const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
            task.product.surfaceIds && task.product.surfaceIds.length > 0 
              ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, task.product.surfaceIds) })
              : [],
            task.product.logoId 
              ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, task.product.logoId) })
              : null,
            task.product.materialId 
              ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, task.product.materialId) })
              : null,
            task.product.bottomTypeId 
              ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, task.product.bottomTypeId) })
              : null,
            task.product.puzzleTypeId 
              ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, task.product.puzzleTypeId) })
              : null
          ]);

          const secondGradeProductData = {
            name: task.product.name,
            dimensions: task.product.dimensions as { length?: number; width?: number; thickness?: number },
            surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
            logo: logo ? { name: logo.name } : undefined,
            material: material ? { name: material.name } : undefined,
            bottomType: bottomType ? { code: bottomType.code } : undefined,
            puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
            carpetEdgeType: task.product.carpetEdgeType || undefined,
            carpetEdgeSides: task.product.carpetEdgeSides || undefined,
            carpetEdgeStrength: task.product.carpetEdgeStrength || undefined,
            pressType: task.product.pressType || 'not_selected',
            borderType: task.product.borderType || 'without_border',
            grade: 'grade_2' as const
          };
          
          const secondGradeArticle = generateArticle(secondGradeProductData);

          const [newSecondGradeProduct] = await tx.insert(schema.products).values({
            name: task.product.name,
            article: secondGradeArticle,
            categoryId: task.product.categoryId,
            productType: task.product.productType,
            dimensions: task.product.dimensions,
            surfaceIds: task.product.surfaceIds,
            logoId: task.product.logoId,
            materialId: task.product.materialId,
            bottomTypeId: task.product.bottomTypeId,
            puzzleTypeId: task.product.puzzleTypeId,
            puzzleSides: task.product.puzzleSides,
            carpetEdgeType: task.product.carpetEdgeType,
            carpetEdgeSides: task.product.carpetEdgeSides,
            carpetEdgeStrength: task.product.carpetEdgeStrength,
            matArea: task.product.matArea,
            weight: task.product.weight,
            pressType: task.product.pressType,
            borderType: task.product.borderType,
            grade: 'grade_2',
            normStock: 0,
            isActive: true,
            notes: `Автоматически создан для 2-го сорта по заданию #${taskId}`
          }).returning();

          secondGradeProductId = newSecondGradeProduct.id;

          // Создаем запись в stock
          await tx.insert(schema.stock).values({
            productId: secondGradeProductId,
            currentStock: 0,
            reservedStock: 0
          });
        } else if (secondGradeProduct !== null && secondGradeQuantity < 0) {
          // Проверяем, есть ли запись в stock для существующего товара
          const existingStock = await tx.query.stock.findFirst({
            where: eq(schema.stock.productId, secondGradeProduct!.id)
          });

          if (!existingStock) {
            // Создаем запись остатков для существующего товара
            await tx.insert(schema.stock).values({
              productId: secondGradeProduct!.id,
              currentStock: 0,
              reservedStock: 0
            });
          }
        }

        // Обновляем остатки товара второго сорта
        if (secondGradeProductId) {
          // Для отрицательных значений проверяем достаточность остатков
          if (secondGradeQuantity < 0) {
            const stockInfo = await tx.query.stock.findFirst({
              where: eq(schema.stock.productId, secondGradeProductId)
            });
            const currentStock = stockInfo?.currentStock || 0;
            const quantityToRemove = Math.abs(secondGradeQuantity);
            if (currentStock < quantityToRemove) {
              throw new Error(`Недостаточно товара 2-го сорта на складе для корректировки. На складе: ${currentStock} шт, требуется убрать: ${quantityToRemove} шт`);
            }
          }
          
          await tx.update(schema.stock)
            .set({
              currentStock: sql`current_stock + ${secondGradeQuantity}`,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, secondGradeProductId));

          // Логируем движение товара
          await tx.insert(schema.stockMovements).values({
            productId: secondGradeProductId,
            movementType: secondGradeQuantity > 0 ? 'incoming' : 'adjustment',
            quantity: Math.abs(secondGradeQuantity),
            referenceId: taskId,
            referenceType: 'production_task',
            comment: `Корректировка 2-го сорта по заданию #${taskId}`,
            userId
          });
        }
      }

      // Обрабатываем товар сорта Либерти
      if (libertyGradeQuantity !== 0) {
        // Находим или создаем товар сорта Либерти
        let libertyGradeProductId = null;
        const libertyGradeProduct = await tx.query.products.findFirst({
          where: and(
            eq(schema.products.name, task.product.name),
            eq(schema.products.grade, 'liber'),
            eq(schema.products.isActive, true)
          )
        });

        if (libertyGradeProduct) {
          libertyGradeProductId = libertyGradeProduct.id;
        } else if (libertyGradeQuantity !== 0) {
          // Создаем новый товар сорта Либерти с полным артикулом
          const { generateArticle } = await import('../utils/articleGenerator');
          
          // Получаем связанные данные для генерации артикула
          const [surfaces, logo, material, bottomType, puzzleType] = await Promise.all([
            task.product.surfaceIds && task.product.surfaceIds.length > 0 
              ? tx.query.productSurfaces.findMany({ where: inArray(schema.productSurfaces.id, task.product.surfaceIds) })
              : [],
            task.product.logoId 
              ? tx.query.productLogos.findFirst({ where: eq(schema.productLogos.id, task.product.logoId) })
              : null,
            task.product.materialId 
              ? tx.query.productMaterials.findFirst({ where: eq(schema.productMaterials.id, task.product.materialId) })
              : null,
            task.product.bottomTypeId 
              ? tx.query.bottomTypes.findFirst({ where: eq(schema.bottomTypes.id, task.product.bottomTypeId) })
              : null,
            task.product.puzzleTypeId 
              ? tx.query.puzzleTypes.findFirst({ where: eq(schema.puzzleTypes.id, task.product.puzzleTypeId) })
              : null
          ]);

          const libertyGradeProductData = {
            name: task.product.name,
            dimensions: task.product.dimensions as { length?: number; width?: number; thickness?: number },
            surfaces: surfaces.length > 0 ? surfaces.map((s: any) => ({ name: s.name })) : undefined,
            logo: logo ? { name: logo.name } : undefined,
            material: material ? { name: material.name } : undefined,
            bottomType: bottomType ? { code: bottomType.code } : undefined,
            puzzleType: puzzleType ? { name: puzzleType.name } : undefined,
            carpetEdgeType: task.product.carpetEdgeType || undefined,
            carpetEdgeSides: task.product.carpetEdgeSides || undefined,
            carpetEdgeStrength: task.product.carpetEdgeStrength || undefined,
            pressType: task.product.pressType || 'not_selected',
            borderType: task.product.borderType || 'without_border',
            grade: 'liber' as const
          };
          
          const libertyGradeArticle = generateArticle(libertyGradeProductData);

          const [newLibertyGradeProduct] = await tx.insert(schema.products).values({
            name: task.product.name,
            article: libertyGradeArticle,
            categoryId: task.product.categoryId,
            productType: task.product.productType,
            dimensions: task.product.dimensions,
            surfaceIds: task.product.surfaceIds,
            logoId: task.product.logoId,
            materialId: task.product.materialId,
            bottomTypeId: task.product.bottomTypeId,
            puzzleTypeId: task.product.puzzleTypeId,
            puzzleSides: task.product.puzzleSides,
            carpetEdgeType: task.product.carpetEdgeType,
            carpetEdgeSides: task.product.carpetEdgeSides,
            carpetEdgeStrength: task.product.carpetEdgeStrength,
            matArea: task.product.matArea,
            weight: task.product.weight,
            pressType: task.product.pressType,
            borderType: task.product.borderType,
            grade: 'liber',
            normStock: 0,
            isActive: true,
            notes: `Автоматически создан для сорта Либерти по заданию #${taskId}`
          }).returning();

          libertyGradeProductId = newLibertyGradeProduct.id;

          // Создаем запись в stock
          await tx.insert(schema.stock).values({
            productId: libertyGradeProductId,
            currentStock: 0,
            reservedStock: 0
          });
        } else if (libertyGradeProduct !== null && libertyGradeQuantity < 0) {
          // Проверяем, есть ли запись в stock для существующего товара
          const existingStock = await tx.query.stock.findFirst({
            where: eq(schema.stock.productId, libertyGradeProduct!.id)
          });

          if (!existingStock) {
            // Создаем запись остатков для существующего товара
            await tx.insert(schema.stock).values({
              productId: libertyGradeProduct!.id,
              currentStock: 0,
              reservedStock: 0
            });
          }
        }

        // Обновляем остатки товара сорта Либерти
        if (libertyGradeProductId) {
          // Для отрицательных значений проверяем достаточность остатков
          if (libertyGradeQuantity < 0) {
            const stockInfo = await tx.query.stock.findFirst({
              where: eq(schema.stock.productId, libertyGradeProductId)
            });
            const currentStock = stockInfo?.currentStock || 0;
            const quantityToRemove = Math.abs(libertyGradeQuantity);
            if (currentStock < quantityToRemove) {
              throw new Error(`Недостаточно товара сорта Либерти на складе для корректировки. На складе: ${currentStock} шт, требуется убрать: ${quantityToRemove} шт`);
            }
          }
          
          await tx.update(schema.stock)
            .set({
              currentStock: sql`current_stock + ${libertyGradeQuantity}`,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, libertyGradeProductId));

          // Логируем движение товара
          await tx.insert(schema.stockMovements).values({
            productId: libertyGradeProductId,
            movementType: libertyGradeQuantity > 0 ? 'incoming' : 'adjustment',
            quantity: Math.abs(libertyGradeQuantity),
            referenceId: taskId,
            referenceType: 'production_task',
            comment: `Корректировка сорта Либерти по заданию #${taskId}`,
            userId
          });
        }
      }

      // Обрабатываем дополнительные товары
      for (const extra of extraProducts) {
        if (extra.productId && (extra.qualityQuantity > 0 || extra.defectQuantity > 0)) {
          const totalQuantity = (extra.qualityQuantity || 0) + (extra.defectQuantity || 0);
          
          // Добавляем в extras
          await tx.insert(schema.productionTaskExtras).values({
            taskId,
            productId: extra.productId,
            quantity: totalQuantity,
            notes: extra.notes || 'Дополнительный товар'
          });

          // Добавляем на склад только качественные товары
          if (extra.qualityQuantity > 0) {
            await tx.update(schema.stock)
              .set({
                currentStock: sql`${schema.stock.currentStock} + ${extra.qualityQuantity}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, extra.productId));

            // Логируем движение качественных товаров
            await tx.insert(schema.stockMovements).values({
              productId: extra.productId,
              movementType: 'incoming',
              quantity: extra.qualityQuantity,
              referenceId: taskId,
              referenceType: 'production_task_extra',
              comment: `Дополнительный товар (задание #${taskId}) - качественные`,
              userId
            });
          }

          // Логируем брак отдельно
          if (extra.defectQuantity > 0) {
            await tx.insert(schema.stockMovements).values({
              productId: extra.productId,
              movementType: 'incoming',
              quantity: extra.defectQuantity,
              referenceId: taskId,
              referenceType: 'production_task_extra',
              comment: `Дополнительный товар (задание #${taskId}) - брак`,
              userId
            });
          }
        }
      }

      // Пересчитываем статус заказа после завершения производства
      try {
        // Только если задание связано с заказом
        if (task.orderId && task.order) {
        const { analyzeOrderAvailability, cancelUnnecessaryProductionTasks } = await import('../utils/orderStatusCalculator');
        const orderAnalysis = await analyzeOrderAvailability(task.orderId);
        
        // Обновляем статус заказа если он изменился
        if (orderAnalysis.status !== task.order.status) {
          await tx.update(schema.orders)
            .set({ 
              status: orderAnalysis.status as any,
              updatedAt: new Date()
            })
            .where(eq(schema.orders.id, task.orderId));
          }

          // Отменяем ненужные производственные задания если все товары доступны
          const cancelled = await cancelUnnecessaryProductionTasks(task.orderId);
          if (cancelled.cancelled > 0) {
            await tx.insert(schema.orderMessages).values({
              orderId: task.orderId,
              userId,
              message: `🚫 Автоматически отменено ${cancelled.cancelled} ненужных производственных заданий - товары уже доступны`
            });
          }

          // Добавляем уведомление о завершении задания (НЕ о готовности заказа)
            const extraProductsText = extraProducts.length > 0 
              ? `. Дополнительно произведено: ${extraProducts.map((extra: any) => `${extra.quantity} шт.`).join(', ')}` 
              : '';
            
            await tx.insert(schema.orderMessages).values({
              orderId: task.orderId,
              userId,
            message: `📦 Задание на производство выполнено: "${task.product.name}" произведено ${qualityQuantity} шт.${extraProductsText}`
          });

          // Проверяем, готов ли заказ полностью к отгрузке (все товары в наличии)
          const allItemsAvailable = orderAnalysis.items.every(item => 
            item.available_quantity >= item.required_quantity
          );

          // Только если ДЕЙСТВИТЕЛЬНО все товары в наличии - уведомляем о готовности к отгрузке
          if (allItemsAvailable && orderAnalysis.status === 'confirmed') {
            await tx.insert(schema.orderMessages).values({
              orderId: task.orderId,
              userId,
              message: `✅ Заказ готов к отгрузке! Все товары в наличии на складе.`
            });
          }
        }
      } catch (analysisError) {
        // Не прерываем выполнение основной операции из-за ошибки анализа
        console.error('Ошибка пересчета статуса заказа:', analysisError);
      }

      // Распределяем новый товар между заказами
      try {
        const { distributeNewStockToOrders } = await import('../utils/stockDistribution');
        const distributionResult = await distributeNewStockToOrders(task.productId, qualityQuantity);
        
        if (distributionResult.distributed > 0) {
          console.log(`🎯 Распределено ${distributionResult.distributed} шт товара ${task.productId} между ${distributionResult.ordersUpdated.length} заказами`);
        }
      } catch (distributionError) {
        console.error('Ошибка распределения товара:', distributionError);
      }

      return updatedTask[0];
    });

    const secondGradeMessage = secondGradeQuantity > 0 ? ` 2-й сорт: ${secondGradeQuantity} шт.` : '';
    const libertyGradeMessage = libertyGradeQuantity > 0 ? ` Либерти: ${libertyGradeQuantity} шт.` : '';
    const defectMessage = defectQuantity > 0 ? ` Брак: ${defectQuantity} шт.` : '';
    
    res.json({
      success: true,
      data: result,
      message: `Задание успешно завершено. Произведено: ${producedQuantity} шт. (${qualityQuantity} годных${secondGradeMessage}${libertyGradeMessage}${defectMessage}), статус заказа обновлен`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/suggest - Предложить производственное задание
router.post('/tasks/suggest', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      orderId, 
      productId, 
      requestedQuantity, 
      priority = 3, 
      notes, 
      assignedTo,
      // Поля планирования
      plannedStartDate,
      plannedEndDate
    } = req.body;
    const userId = req.user!.id;

    if (!productId || !requestedQuantity || requestedQuantity <= 0) {
      return next(createError('Необходимо указать товар и положительное количество', 400));
    }

    // Проверяем существование товара
    const product = await db.query.products.findFirst({ 
      where: eq(schema.products.id, productId) 
    });

    if (!product) {
      return next(createError('Товар не найден', 404));
    }

    // Проверяем существование заказа (если указан)
    let order = null;
    if (orderId) {
      order = await db.query.orders.findFirst({ 
        where: eq(schema.orders.id, orderId) 
      });

    if (!order) {
      return next(createError('Заказ не найден', 404));
    }
    }

    // Валидация планирования (даты обязательны)
    const planningValidation = validateProductionPlanning({
      plannedStartDate,
      plannedEndDate
    });

    if (!planningValidation.valid) {
      return next(createError(planningValidation.error || 'Некорректные данные планирования', 400));
    }

    // Проверка перекрытий отключена - разрешены параллельные задания

    // Создаем производственное задание
    const taskData: any = {
      productId,
      requestedQuantity,
      priority,
      createdBy: userId,
      assignedTo: assignedTo || userId,
      status: 'pending',  // сразу готово к работе
      
      // Поля планирования (обязательные)
      plannedStartDate: new Date(plannedStartDate),
      plannedEndDate: new Date(plannedEndDate),
      planningStatus: 'confirmed'  // всегда подтвержденное планирование
    };

    // Добавляем заказ если указан
    if (orderId) {
      taskData.orderId = orderId;
      taskData.notes = notes || `Создано для заказа ${order!.orderNumber}`;
    } else {
      taskData.notes = notes || `Производственное задание на будущее`;
    }

    const newTask = await db.insert(schema.productionTasks).values(taskData).returning();

    // Получаем полные данные задания
    const fullTask = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, newTask[0].id),
      with: {
        order: true,
        product: {
          with: {
            category: true
          }
        },
        createdByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: fullTask,
      message: 'Задание создано'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/sync/full - Full synchronization between production_queue and production_tasks
router.post('/sync/full', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const syncResult = await fullProductionSync();

    res.json({
      success: true,
      data: syncResult,
      message: `Синхронизация завершена: мигрировано ${syncResult.summary.totalMigrated}, 
                существующих ${syncResult.summary.totalExisting}, 
                ошибок ${syncResult.summary.totalErrors}`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/sync/queue - Sync production_queue to production_tasks
router.post('/sync/queue', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const syncResult = await syncProductionQueueToTasks();

    res.json({
      success: true,
      data: syncResult,
      message: `Синхронизация очереди завершена: мигрировано ${syncResult.migrated}, 
                существующих ${syncResult.existing}, ошибок ${syncResult.errors.length}`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/sync/orders - Create tasks for pending orders
router.post('/sync/orders', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const syncResult = await createTasksForPendingOrders();

    res.json({
      success: true,
      data: syncResult,
      message: `Создание заданий для заказов завершено: создано ${syncResult.migrated}, 
                существующих ${syncResult.existing}, ошибок ${syncResult.errors.length}`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/recalculate - Recalculate production needs
router.post('/recalculate', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { recalculateProductionNeeds } = await import('../utils/productionSynchronizer');
    const result = await recalculateProductionNeeds();

    res.json({
      success: true,
      data: result,
      message: `Пересчет потребностей завершен: создано ${result.created}, обновлено ${result.updated}, отменено ${result.cancelled}, ошибок ${result.errors.length}`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/sync/stats - Get synchronization statistics
router.get('/sync/stats', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { getSyncStatistics } = await import('../utils/productionSynchronizer');
    const stats = await getSyncStatistics();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/notify-ready - Send notifications for ready orders
router.post('/notify-ready', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const { notifyReadyOrders } = await import('../utils/productionSynchronizer');
    const result = await notifyReadyOrders();

    res.json({
      success: true,
      data: result,
      message: `Уведомления отправлены: ${result.notified} заказов, ошибок ${result.errors.length}`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/sync/statistics - Get sync statistics
router.get('/sync/statistics', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const statistics = await getSyncStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/production/tasks/:id - Delete production task (only pending status)
router.delete('/tasks/:id', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const userId = req.user!.id;

    if (!taskId || isNaN(taskId)) {
      return next(createError('Некорректный ID задания', 400));
    }

    // Проверяем существование задания
    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId),
      with: {
        order: {
          columns: {
            id: true,
            orderNumber: true
          }
        },
        product: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    // Можно удалять только задания в статусе pending
    if (task.status !== 'pending') {
      return next(createError('Можно удалять только задания в статусе "Ожидает"', 400));
    }

    // Удаляем задание в транзакции
    await db.transaction(async (tx) => {
      // Сначала удаляем связанные дополнительные товары (если есть)
      await tx.delete(schema.productionTaskExtras)
        .where(eq(schema.productionTaskExtras.taskId, taskId));

      // Затем удаляем само задание
      await tx.delete(schema.productionTasks)
        .where(eq(schema.productionTasks.id, taskId));

      // Логируем удаление
      await tx.insert(schema.auditLog).values({
        tableName: 'production_tasks',
        recordId: taskId,
        operation: 'DELETE',
        oldValues: {
          id: task.id,
          productId: task.productId,
          productName: task.product.name,
          requestedQuantity: task.requestedQuantity,
          status: task.status,
          orderId: task.orderId,
          orderNumber: task.order?.orderNumber
        },
        userId
      });
    });

    res.json({
      success: true,
      message: `Задание на производство товара "${task.product.name}" удалено`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/tasks/by-product/:productId - Get production tasks by product
router.get('/tasks/by-product/:productId', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const { status = 'pending,in_progress' } = req.query;

    if (isNaN(productId) || productId <= 0) {
      return next(createError('Некорректный ID товара', 400));
    }

    // Валидируем и очищаем статусы
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    const statusList = (status as string)
      .split(',')
      .map(s => s.trim())
      .filter(s => validStatuses.includes(s));

    // Если нет валидных статусов, используем все
    if (statusList.length === 0) {
      statusList.push(...validStatuses);
    }

    const tasks = await db.query.productionTasks.findMany({
      where: and(
        eq(schema.productionTasks.productId, productId),
        statusList.length > 0 ? inArray(schema.productionTasks.status, statusList as any) : undefined
      ),
      with: {
        order: {
          with: {
            manager: {
              columns: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        product: {
          with: {
            category: true,
            stock: true,
            bottomType: true,
            puzzleType: true,
            rollComposition: {
              with: {
                carpet: {
                  columns: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          },
          // Добавляем недостающие поля для отображения в UI
          columns: {
            article: true,
            productType: true,
            purNumber: true,
            pressType: true,
            grade: true,
            borderType: true,
            tags: true,
            notes: true,
            carpetEdgeType: true,
            carpetEdgeSides: true,
            carpetEdgeStrength: true,
            puzzleSides: true,
            dimensions: true,
            weight: true,
            matArea: true,
            characteristics: true,
            puzzleOptions: true,
            surfaceIds: true
          }
        },
        createdByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        assignedToUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        startedByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        },
        completedByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: [
        desc(schema.productionTasks.priority),
        asc(schema.productionTasks.sortOrder),
        desc(schema.productionTasks.createdAt)
      ],
      limit: 50
    });

    // Загружаем множественные поверхности для каждого товара
    const tasksWithSurfaces = await Promise.all(
      tasks.map(async (task) => {
        let surfaces: any[] = [];
        if (task.product.surfaceIds && task.product.surfaceIds.length > 0) {
          surfaces = await db.query.productSurfaces.findMany({
            where: inArray(schema.productSurfaces.id, task.product.surfaceIds)
          });
        }
        
        return {
          ...task,
          product: {
            ...task.product,
            surfaces
          }
        };
      })
    );

    res.json({
      success: true,
      data: tasksWithSurfaces
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/export - Export production tasks to Excel (Задача 9.2)
router.post('/tasks/export', authenticateToken, requireExportPermission('production'), async (req: AuthRequest, res, next) => {
  try {
    const { filters, format = 'xlsx' } = req.body; // добавляем параметр format

    let whereConditions: any[] = [];

    // Применяем фильтры если они переданы
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        const statusArray = filters.status.split(',').map((s: string) => s.trim());
        if (statusArray.length === 1) {
          whereConditions.push(eq(schema.productionTasks.status, statusArray[0] as any));
        } else {
          whereConditions.push(inArray(schema.productionTasks.status, statusArray as any[]));
        }
      }

      if (filters.assignedTo && filters.assignedTo !== 'all') {
        whereConditions.push(eq(schema.productionTasks.assignedTo, parseInt(filters.assignedTo)));
      }

      if (filters.priority && filters.priority !== 'all') {
        whereConditions.push(eq(schema.productionTasks.priority, parseInt(filters.priority)));
      }

      // Убираем поиск для избежания проблем с join
      // if (filters.search) {
      //   // Поиск временно отключен
      // }

      if (filters.dateFrom) {
        whereConditions.push(sql`${schema.productionTasks.createdAt} >= ${filters.dateFrom}`);
      }

      if (filters.dateTo) {
        whereConditions.push(sql`${schema.productionTasks.createdAt} <= ${filters.dateTo}`);
      }
    }

    // Получаем производственные задания с полной информацией
    const tasks = await db.query.productionTasks.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        order: true,
        product: true,
        createdByUser: true,
        assignedToUser: true,
        startedByUser: true,
        completedByUser: true
      },
      orderBy: [desc(schema.productionTasks.priority), asc(schema.productionTasks.sortOrder)]
    });

    // Форматируем данные для Excel
    const formattedData = ExcelExporter.formatProductionTasksData(tasks);

    // Генерируем имя файла
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileExtension = format === 'csv' ? 'csv' : 'xlsx';
    const filename = `production-tasks-export-${timestamp}.${fileExtension}`;

    // Экспортируем в указанном формате (Задача 3: Дополнительные форматы)
    await ExcelExporter.exportData(res, {
      filename,
      sheetName: 'Производственные задания',
      title: `Экспорт производственных заданий - ${new Date().toLocaleDateString('ru-RU')}`,
      columns: ExcelExporter.getProductionTasksColumns(),
      data: formattedData,
      format
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/production/tasks/:id/cancel - Отменить производственное задание
router.put('/tasks/:id/cancel', authenticateToken, requirePermission('production', 'manage'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { reason } = req.body;
    const userId = req.user!.id;

    // Валидация обязательной причины
    if (!reason || reason.trim().length === 0) {
      return next(createError('Причина отмены обязательна для указания', 400));
    }

    // Получаем задание с деталями
    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId),
      with: {
        product: true,
        order: true
      }
    });

    if (!task) {
      return next(createError('Производственное задание не найдено', 404));
    }

    // Проверяем возможность отмены
    if (task.status === 'completed') {
      return next(createError('Нельзя отменить завершенное производственное задание', 400));
    }

    if (task.status === 'cancelled') {
      return next(createError('Производственное задание уже отменено', 400));
    }

    // Используем транзакцию для атомарности
    const result = await db.transaction(async (tx) => {
      // Отменяем задание
      const updatedTask = await tx.update(schema.productionTasks)
        .set({
          status: 'cancelled',
          cancelledBy: userId,
          cancelReason: reason.trim(),
          updatedAt: new Date()
        })
        .where(eq(schema.productionTasks.id, taskId))
        .returning();

      // Формируем детальное сообщение для аудита
      const produced = task.producedQuantity || 0;
      const quality = task.qualityQuantity || 0;
      let auditComment = `Производственное задание #${taskId} отменено. Причина: ${reason.trim()}`;
      
      if (produced > 0) {
        auditComment += `. Произведенная продукция (${produced} шт., из них ${quality} шт. качественных) сохранена на складе`;
      }

      // Аудит лог
      await tx.insert(schema.auditLog).values({
        tableName: 'production_tasks',
        recordId: taskId,
        operation: 'UPDATE',
        oldValues: task,
        newValues: updatedTask[0],
        userId
      });

      // Добавляем сообщение в заказ (если задание связано с заказом)
      if (task.orderId) {
        await tx.insert(schema.orderMessages).values({
          orderId: task.orderId,
          userId,
          message: `🚫 Производственное задание отменено: "${task.product.name}" (${task.requestedQuantity} шт.). Причина: ${reason.trim()}`
        });
      }

      return { task: updatedTask[0], auditComment };
    });

    res.json({
      success: true,
      message: 'Производственное задание успешно отменено',
      data: {
        task: result.task,
        auditInfo: result.auditComment
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/production/planning/suggest - Получить предложения оптимального планирования
router.get('/planning/suggest', authenticateToken, requirePermission('production', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const { productId, quantity } = req.query;
    
    if (!productId || !quantity) {
      return next(createError('Необходимо указать productId и quantity', 400));
    }
    
    // Оптимальное планирование отключено - разрешены параллельные задания
    res.json({
      success: true,
      data: {
        message: 'Планирование отключено - можно создавать задания с любыми датами'
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/planning/overlaps - Проверить перекрытия
router.get('/planning/overlaps', authenticateToken, requirePermission('production', 'view'), async (req: AuthRequest, res, next) => {
  try {
    const { plannedStartDate, plannedEndDate, excludeTaskId } = req.query;
    
    if (!plannedStartDate || !plannedEndDate) {
      return next(createError('Необходимо указать plannedStartDate и plannedEndDate', 400));
    }
    
    // Проверка перекрытий отключена - разрешены параллельные задания
    res.json({
      success: true,
      data: {
        overlaps: [],
        suggestions: []
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router; 