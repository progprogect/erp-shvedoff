import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { 
  fullProductionSync, 
  syncProductionQueueToTasks, 
  createTasksForPendingOrders, 
  getSyncStatistics 
} from '../utils/productionSynchronizer.js';

const router = express.Router();

// GET /api/production/queue - Get production queue
router.get('/queue', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
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
router.get('/queue/:id', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
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
router.put('/queue/:id/status', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
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
        // Check if all items for this order are completed
        const allOrderProductionItems = await db.query.productionQueue.findMany({
          where: eq(schema.productionQueue.orderId, productionItem.orderId)
        });

        const allCompleted = allOrderProductionItems.every(item => 
          item.id === productionId || item.status === 'completed'
        );

        if (allCompleted) {
          // Update order status to ready
          await db.update(schema.orders)
            .set({
              status: 'ready',
              updatedAt: new Date()
            })
            .where(eq(schema.orders.id, productionItem.orderId));

          // Add message to order about production completion
          await db.insert(schema.orderMessages).values({
            orderId: productionItem.orderId,
            userId,
            message: 'Производство завершено. Заказ готов к отгрузке.'
          });
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
router.post('/auto-queue', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
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
router.post('/queue', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
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
router.get('/stats', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
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

// GET /api/production/tasks - Get production tasks (предложения и активные задания)
router.get('/tasks', authenticateToken, authorizeRoles('manager', 'production', 'director'), async (req: AuthRequest, res, next) => {
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
            stock: true
          }
        },
        suggestedByUser: {
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
        approvedByUser: {
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
        desc(schema.productionTasks.priority),
        asc(schema.productionTasks.sortOrder),
        desc(schema.productionTasks.suggestedAt)
      ],
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/production/tasks/by-product - Группировка заданий по товарам
router.get('/tasks/by-product', authenticateToken, authorizeRoles('manager', 'production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const { status = 'approved,in_progress' } = req.query;
    const statusList = (status as string).split(',');

    // Получаем активные задания
    const tasks = await db.query.productionTasks.findMany({
      where: inArray(schema.productionTasks.status, statusList as any),
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
            category: true
          }
        }
      },
      orderBy: [
        asc(schema.productionTasks.productId),
        desc(schema.productionTasks.priority)
      ]
    });

    // Группируем по товарам
    const groupedTasks = tasks.reduce((acc, task) => {
      const productId = task.productId;
      
      if (!acc[productId]) {
        acc[productId] = {
          product: task.product,
          totalQuantity: 0,
          tasks: []
        };
      }
      
      acc[productId].totalQuantity += task.approvedQuantity || task.requestedQuantity;
      acc[productId].tasks.push(task);
      
      return acc;
    }, {} as Record<number, any>);

    // Преобразуем в массив
    const result = Object.values(groupedTasks);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/:id/approve - Подтвердить задание
router.post('/tasks/:id/approve', authenticateToken, authorizeRoles('manager', 'production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { approvedQuantity, notes } = req.body;
    const userId = req.user!.id;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    if (task.status !== 'suggested') {
      return next(createError('Можно подтвердить только предложенные задания', 400));
    }

    // Обновляем задание
    const updatedTask = await db.update(schema.productionTasks)
      .set({
        status: 'approved',
        approvedQuantity: approvedQuantity || task.requestedQuantity,
        approvedBy: userId,
        approvedAt: new Date(),
        notes: notes || task.notes,
        updatedAt: new Date()
      })
      .where(eq(schema.productionTasks.id, taskId))
      .returning();

    res.json({
      success: true,
      data: updatedTask[0],
      message: 'Задание подтверждено'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/:id/reject - Отклонить задание
router.post('/tasks/:id/reject', authenticateToken, authorizeRoles('manager', 'production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { rejectReason } = req.body;
    const userId = req.user!.id;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    if (task.status !== 'suggested') {
      return next(createError('Можно отклонить только предложенные задания', 400));
    }

    // Обновляем задание
    const updatedTask = await db.update(schema.productionTasks)
      .set({
        status: 'rejected',
        rejectReason,
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.productionTasks.id, taskId))
      .returning();

    res.json({
      success: true,
      data: updatedTask[0],
      message: 'Задание отклонено'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/:id/postpone - Отложить задание
router.post('/tasks/:id/postpone', authenticateToken, authorizeRoles('manager', 'production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { notes } = req.body;

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    if (task.status !== 'suggested') {
      return next(createError('Можно отложить только предложенные задания', 400));
    }

    // Обновляем задание
    const updatedTask = await db.update(schema.productionTasks)
      .set({
        status: 'postponed',
        notes: notes || task.notes,
        updatedAt: new Date()
      })
      .where(eq(schema.productionTasks.id, taskId))
      .returning();

    res.json({
      success: true,
      data: updatedTask[0],
      message: 'Задание отложено'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/production/tasks/:id/order - Изменить порядок заданий (drag-and-drop)
router.put('/tasks/reorder', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
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

// POST /api/production/tasks/:id/start - Начать выполнение задания
router.post('/tasks/:id/start', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);

    const task = await db.query.productionTasks.findFirst({
      where: eq(schema.productionTasks.id, taskId)
    });

    if (!task) {
      return next(createError('Задание не найдено', 404));
    }

    if (task.status !== 'approved') {
      return next(createError('Можно начать только подтвержденные задания', 400));
    }

    // Обновляем задание
    const updatedTask = await db.update(schema.productionTasks)
      .set({
        status: 'in_progress',
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

// POST /api/production/tasks/:id/complete - Завершить задание с указанием результатов
router.post('/tasks/:id/complete', authenticateToken, authorizeRoles('production', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { 
      producedQuantity, 
      qualityQuantity, 
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

    // Валидация
    if (producedQuantity < 0 || qualityQuantity < 0 || defectQuantity < 0) {
      return next(createError('Количество не может быть отрицательным', 400));
    }

    if (qualityQuantity + defectQuantity !== producedQuantity) {
      return next(createError('Сумма годных и брака должна равняться произведенному количеству', 400));
    }

    // Используем транзакцию для атомарности операций
    const result = await db.transaction(async (tx) => {
      // Обновляем задание
      const updatedTask = await tx.update(schema.productionTasks)
        .set({
          status: 'completed',
          producedQuantity,
          qualityQuantity,
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

      // Обрабатываем дополнительные товары
      for (const extra of extraProducts) {
        if (extra.productId && extra.quantity > 0) {
          // Добавляем в extras
          await tx.insert(schema.productionTaskExtras).values({
            taskId,
            productId: extra.productId,
            quantity: extra.quantity,
            notes: extra.notes || 'Дополнительный товар'
          });

          // Добавляем на склад
          await tx.update(schema.stock)
            .set({
              currentStock: sql`${schema.stock.currentStock} + ${extra.quantity}`,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, extra.productId));

          // Логируем движение
          await tx.insert(schema.stockMovements).values({
            productId: extra.productId,
            movementType: 'incoming',
            quantity: extra.quantity,
            referenceId: taskId,
            referenceType: 'production_task_extra',
            comment: `Дополнительный товар (задание #${taskId})`,
            userId
          });
        }
      }

      // ДОБАВЛЕНО: Пересчитываем статус заказа после завершения производства
      try {
        const { analyzeOrderAvailability } = await import('../utils/orderStatusCalculator.js');
        const orderAnalysis = await analyzeOrderAvailability(task.orderId);
        
        // Обновляем статус заказа если он изменился
        if (orderAnalysis.status !== task.order.status) {
          await tx.update(schema.orders)
            .set({ 
              status: orderAnalysis.status as any,
              updatedAt: new Date()
            })
            .where(eq(schema.orders.id, task.orderId));

          // Логируем изменение статуса
          await tx.insert(schema.stockMovements).values({
            productId: task.productId,
            movementType: 'adjustment', 
            quantity: 0,
            referenceId: task.orderId,
            referenceType: 'order_status_change',
            comment: `Статус заказа изменен на "${orderAnalysis.status}" после завершения производства`,
            userId
          });

          // Если заказ стал готов к отгрузке - добавляем сообщение в чат заказа
          if (orderAnalysis.status === 'confirmed' || orderAnalysis.status === 'ready') {
            const extraProductsText = extraProducts.length > 0 
              ? `. Дополнительно произведено: ${extraProducts.map((extra: any) => `${extra.quantity} шт.`).join(', ')}` 
              : '';
            
            await tx.insert(schema.orderMessages).values({
              orderId: task.orderId,
              userId,
              message: `✅ Заказ готов к отгрузке! Завершено производство товара "${task.product.name}" (${qualityQuantity} шт.)${extraProductsText}.`
            });
          }
        }
      } catch (analysisError) {
        // Не прерываем выполнение основной операции из-за ошибки анализа
        console.error('Ошибка пересчета статуса заказа:', analysisError);
      }

      return updatedTask[0];
    });

    res.json({
      success: true,
      data: result,
      message: 'Задание успешно завершено, статус заказа обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/tasks/suggest - Предложить производственное задание
router.post('/tasks/suggest', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const { orderId, productId, requestedQuantity, priority = 3, notes, assignedTo } = req.body;
    const userId = req.user!.id;

    if (!orderId || !productId || !requestedQuantity || requestedQuantity <= 0) {
      return next(createError('Необходимо указать заказ, товар и положительное количество', 400));
    }

    // Проверяем существование заказа и товара
    const [order, product] = await Promise.all([
      db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) }),
      db.query.products.findFirst({ where: eq(schema.products.id, productId) })
    ]);

    if (!order) {
      return next(createError('Заказ не найден', 404));
    }

    if (!product) {
      return next(createError('Товар не найден', 404));
    }

    // Создаем предложение задания
    const newTask = await db.insert(schema.productionTasks).values({
      orderId,
      productId,
      requestedQuantity,
      priority,
      suggestedBy: userId,
      assignedTo: assignedTo || userId, // По умолчанию назначаем на создателя
      notes: notes || `Предложено для заказа ${order.orderNumber}`,
      status: 'suggested'
    }).returning();

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
        suggestedByUser: {
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
      message: 'Предложение создано'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/sync/full - Full synchronization between production_queue and production_tasks
router.post('/sync/full', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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
router.post('/sync/queue', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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
router.post('/sync/orders', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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
router.post('/recalculate', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { recalculateProductionNeeds } = await import('../utils/productionSynchronizer.js');
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
router.get('/sync/stats', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { getSyncStatistics } = await import('../utils/productionSynchronizer.js');
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
router.post('/notify-ready', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { notifyReadyOrders } = await import('../utils/productionSynchronizer.js');
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
router.get('/sync/statistics', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
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

export default router; 