import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { requireExportPermission } from '../middleware/permissions';
import { createError } from '../middleware/errorHandler';
import { performStockOperation } from '../utils/stockManager';
import { analyzeOrderAvailability, updateOrderStatus } from '../utils/orderStatusCalculator';
import { ExcelExporter } from '../utils/excelExporter';
import { checkAndUpdateAllShippedOrders } from '../utils/orderShipmentChecker';
import { parsePrice, calculateOrderTotal as calculateOrderTotalBackend } from '../utils/priceUtils';

const router = express.Router();

// GET /api/orders - Get orders list
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { status, priority, managerId, limit = 50, offset = 0 } = req.query;
    const userRole = req.user!.role;
    const userId = req.user!.id;

    let whereConditions = [];

    // Role-based filtering
    if (userRole === 'manager') {
      whereConditions.push(eq(schema.orders.managerId, userId));
    }

    if (status) {
      const statusArray = (status as string).split(',').map(s => s.trim());
      if (statusArray.length === 1) {
        whereConditions.push(eq(schema.orders.status, statusArray[0] as any));
      } else {
        whereConditions.push(inArray(schema.orders.status, statusArray as any[]));
      }
    }

    if (priority) {
      whereConditions.push(eq(schema.orders.priority, priority as any));
    }

    if (managerId && userRole !== 'manager') {
      whereConditions.push(eq(schema.orders.managerId, Number(managerId)));
    }

    const orders = await db.query.orders.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        manager: {
          columns: {
            passwordHash: false
          }
        },
        items: {
          with: {
            product: {
              with: {
                stock: true
              }
            }
          }
        }
      },
      orderBy: sql`${schema.orders.createdAt} DESC`,
      limit: Number(limit),
      offset: Number(offset)
    });

    // Пересчитываем статусы для невыполненных заказов
    try {
      const { recalculateAllOrderStatuses } = await import('../utils/orderStatusCalculator');
      
      // Получаем только невыполненные заказы из текущего списка
      const incompleteOrders = orders.filter(order => 
        order.status && ['new', 'confirmed', 'in_production'].includes(order.status)
      );
      
      if (incompleteOrders.length > 0) {
        console.log(`🔄 Пересчитываем статусы ${incompleteOrders.length} невыполненных заказов при загрузке списка`);
        
        // Пересчитываем статусы параллельно для ускорения
        await Promise.all(
          incompleteOrders.map(order => 
            updateOrderStatus(order.id).catch(error => 
              console.error(`❌ Ошибка пересчета статуса заказа ${order.id}:`, error)
            )
          )
        );
        
        // Проверяем заказы со статусом "Готов к отгрузке" на полную отгрузку
        // УБРАНО: дублирующий вызов, проверка происходит только на странице заказа
        
        // Получаем обновленные данные заказов
        const updatedOrders = await db.query.orders.findMany({
          where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
          with: {
            manager: {
              columns: {
                passwordHash: false
              }
            },
            items: {
              with: {
                product: {
                  with: {
                    stock: true
                  }
                }
              }
            }
          },
          orderBy: sql`${schema.orders.createdAt} DESC`,
          limit: Number(limit),
          offset: Number(offset)
        });
        
        res.json({
          success: true,
          data: updatedOrders
        });
      } else {
        res.json({
          success: true,
          data: orders
        });
      }
    } catch (error) {
      console.error('❌ Ошибка пересчета статусов заказов:', error);
      // В случае ошибки возвращаем исходные данные
      res.json({
        success: true,
        data: orders
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - Get order details
router.get('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const userRole = req.user!.role;
    const userId = req.user!.id;

    let whereCondition;
    
    // Role-based access control
    if (userRole === 'manager') {
      whereCondition = and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.managerId, userId)
      );
    } else {
      whereCondition = eq(schema.orders.id, orderId);
    }

    const order = await db.query.orders.findFirst({
      where: whereCondition,
      with: {
        manager: {
          columns: {
            passwordHash: false
          }
        },
        items: {
          with: {
            product: {
              with: {
                stock: true,
                category: true
              }
            }
          }
        },
        messages: {
          with: {
            user: {
              columns: {
                passwordHash: false
              }
            }
          },
          orderBy: sql`${schema.orderMessages.createdAt} ASC`
        }
      }
    });

    if (!order) {
      return next(createError('Order not found', 404));
    }

    // Пересчитываем статус заказа при входе на страницу (на случай если триггеры не сработали)
    try {
      // СТАБИЛИЗАЦИЯ: не пересчитываем статус если заказ уже отгружен
      if (order.status === 'completed') {
        console.log(`✅ Заказ ${order.orderNumber} уже отгружен - пропускаем пересчет статуса`);
      } else {
        const { analyzeOrderAvailability } = await import('../utils/orderStatusCalculator');
        const orderAnalysis = await analyzeOrderAvailability(orderId);
        
        // Обновляем статус если он изменился
        if (orderAnalysis.status !== order.status) {
          await db.update(schema.orders)
            .set({ 
              status: orderAnalysis.status as any,
              updatedAt: new Date()
            })
            .where(eq(schema.orders.id, orderId));
          
          // Обновляем локальную копию для ответа
          order.status = orderAnalysis.status as any;
          
          console.log(`🔄 Статус заказа ${order.orderNumber} обновлен при входе на страницу: ${order.status}`);
        }
        
        // Если заказ в статусе "Готов к отгрузке", проверяем полную отгрузку
        if (order.status === 'ready') {
          const { updateOrderStatusIfFullyShipped } = await import('../utils/orderShipmentChecker');
          const wasUpdated = await updateOrderStatusIfFullyShipped(orderId, userId);
          if (wasUpdated) {
            order.status = 'completed';
            console.log(`📦 Заказ ${order.orderNumber} автоматически переведен в статус "Отгружен" при входе на страницу`);
          }
        }
      }
    } catch (error) {
      console.error(`Ошибка пересчета статуса заказа ${orderId} при входе на страницу:`, error);
      // Не прерываем выполнение, просто логируем ошибку
    }

    // Helper function to calculate production quantity for products
    async function getProductionQuantities(productIds: number[]) {
      if (productIds.length === 0) {
        return new Map<number, number>();
      }

      // Дополнительная валидация массива productIds
      const validProductIds = productIds.filter(id => Number.isInteger(id) && id > 0);
      if (validProductIds.length === 0) {
        return new Map<number, number>();
      }

      const tasksQuery = db
        .select({
          productId: schema.productionTasks.productId,
          quantity: sql<number>`
            COALESCE(SUM(
              CASE 
                WHEN ${schema.productionTasks.status} IN ('pending', 'in_progress') 
                THEN ${schema.productionTasks.requestedQuantity}
                ELSE 0
              END
            ), 0)
          `.as('quantity')
        })
        .from(schema.productionTasks)
        .where(
          and(
            inArray(schema.productionTasks.status, ['pending', 'in_progress']),
            inArray(schema.productionTasks.productId, validProductIds)
          )
        )
        .groupBy(schema.productionTasks.productId);

      const inProduction = await tasksQuery;
      const productionMap = new Map<number, number>();

      inProduction.forEach(item => {
        // Добавляем валидацию и обработку числовых данных
        const quantity = Number(item.quantity) || 0;
        
        // Проверяем на разумность значения
        if (quantity < 0 || quantity > 1000000) {
          console.warn(`⚠️ Подозрительное значение производства для товара ${item.productId}: ${quantity}. Устанавливаем 0.`);
          productionMap.set(item.productId, 0);
        } else {
          productionMap.set(item.productId, quantity);
        }
      });

      return productionMap;
    }

    // Helper function to calculate reserved quantities from active orders
    async function getReservedQuantities(productIds: number[], excludeOrderId?: number) {
      if (productIds.length === 0) {
        return new Map<number, number>();
      }

      // Дополнительная валидация массива productIds
      const validProductIds = productIds.filter(id => Number.isInteger(id) && id > 0);
      if (validProductIds.length === 0) {
        return new Map<number, number>();
      }

      let whereConditions = [
        inArray(schema.orderItems.productId, validProductIds),
        inArray(schema.orders.status, ['new', 'confirmed', 'in_production', 'completed'])
      ];

      // Исключаем текущий заказ из расчета резерва
      if (excludeOrderId) {
        whereConditions.push(sql`${schema.orders.id} != ${excludeOrderId}`);
      }

      const reservedQuery = db
        .select({
          productId: schema.orderItems.productId,
          quantity: sql<number>`SUM(${schema.orderItems.quantity})`.as('quantity')
        })
        .from(schema.orderItems)
        .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
        .where(and(...whereConditions))
        .groupBy(schema.orderItems.productId);

      const reservedData = await reservedQuery;
      const reservedMap = new Map<number, number>();

      reservedData.forEach(item => {
        reservedMap.set(item.productId, item.quantity);
      });

      return reservedMap;
    }

    // Получаем ID всех продуктов в заказе
    const productIds = order.items?.map(item => {
      const id = typeof item.productId === 'string' ? parseInt(item.productId, 10) : Number(item.productId);
      return id;
    }).filter(id => Number.isInteger(id) && id > 0) || [];
    
    // Получаем данные о производстве и резервах
    // Исключаем текущий заказ из расчета резерва для корректного отображения доступности
    const [productionQuantities, reservedQuantities] = await Promise.all([
      getProductionQuantities(productIds),
      getReservedQuantities(productIds, order.id)
    ]);

    // Обогащаем данные о товарах
    const enrichedOrder = {
      ...order,
      items: order.items?.map(item => {
        const stock = item.product?.stock;
        const currentStock = stock?.currentStock || 0;
        const reserved = reservedQuantities.get(item.productId) || 0;
        const inProduction = productionQuantities.get(item.productId) || 0;
        const available = currentStock - reserved;

        return {
          ...item,
          product: {
            ...item.product,
            stock: {
              ...stock,
              currentStock,
              reservedStock: reserved,
              availableStock: available,
              inProductionQuantity: inProduction
            }
          }
        };
      })
    };

    res.json({
      success: true,
      data: enrichedOrder
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders - Create new order
router.post('/', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      customerName, 
      customerContact, 
      contractNumber, // Номер договора
      deliveryDate, 
      priority = 'normal', 
      source = 'database',
      customSource,
      items, 
      notes,
      managerId // Добавляем возможность назначить заказ на другого менеджера
    } = req.body;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return next(createError('Customer name and items are required', 400));
    }

    // Валидация товаров и цен
    const validatedItems = [];
    for (const item of items) {
      if (!item.productId || !item.quantity) {
        return next(createError('Product ID and quantity are required for all items', 400));
      }

      // Валидация цены товара
      if (item.price !== undefined && item.price !== null && item.price !== '') {
        const priceResult = parsePrice(item.price);
        if (!priceResult.success) {
          return next(createError(`Ошибка в цене товара: ${priceResult.error}`, 400));
        }
        validatedItems.push({
          ...item,
          price: priceResult.value
        });
      } else {
        validatedItems.push(item);
      }
    }

    // Валидация источника заказа
    const validSources = ['database', 'website', 'avito', 'referral', 'cold_call', 'other'];
    if (source && !validSources.includes(source)) {
      return next(createError('Invalid order source', 400));
    }

    // Если источник "other", то customSource обязателен
    if (source === 'other' && (!customSource || customSource.trim() === '')) {
      return next(createError('Custom source description is required when source is "other"', 400));
    }

    // Определяем менеджера заказа
    let assignedManagerId = currentUserId; // По умолчанию - текущий пользователь
    
    if (managerId && managerId !== currentUserId) {
      // Проверяем права на назначение заказа на другого пользователя
      if (currentUserRole !== 'director') {
        return next(createError('Только директор может назначать заказы на других пользователей', 403));
      }
      
      // Проверяем, что указанный пользователь существует и активен
      const targetManager = await db.query.users.findFirst({
        where: and(
          eq(schema.users.id, managerId),
          eq(schema.users.isActive, true)
        )
      });
      
      if (!targetManager) {
        return next(createError('Указанный менеджер не найден или неактивен', 404));
      }
      
      assignedManagerId = managerId;
    }

    // Generate order number
    const orderCountResult = await db.select({ count: sql`count(*)` }).from(schema.orders);
    const orderCount = Number(orderCountResult[0]?.count || 0);
    const currentYear = new Date().getFullYear();
    const orderNumber = `ORD-${currentYear}-${String(orderCount + 1).padStart(3, '0')}`;

    // Calculate total amount using validated items and precise arithmetic
    const totalAmount = parseFloat(calculateOrderTotalBackend(validatedItems.map(item => ({
      price: item.price || 0,
      quantity: item.quantity || 0
    }))));

    // Create order
    const newOrder = await db.insert(schema.orders).values({
      orderNumber,
      customerName,
      customerContact,
      contractNumber, // Номер договора
      status: 'new',
      priority,
      source,
      customSource: source === 'other' ? customSource : null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      managerId: assignedManagerId, // Используем назначенного менеджера
      totalAmount: totalAmount.toString(),
      notes
    }).returning();

    const orderId = newOrder[0].id;

    // Create order items and check/reserve stock
    const itemsNeedingProduction = [];
    
    for (const item of validatedItems) {
      // Create order item with validated price
      await db.insert(schema.orderItems).values({
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      });

      // Check stock availability
      const stock = await db.query.stock.findFirst({
        where: eq(schema.stock.productId, item.productId)
      });

      let quantityToReserve = 0;
      if (stock) {
        // Получаем реальные резервы из активных заказов (исключая текущий заказ)
        const totalReservedResult = await db
          .select({
            total_reserved: sql<number>`COALESCE(SUM(${schema.orderItems.reservedQuantity}), 0)`.as('total_reserved')
          })
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .where(
            and(
              eq(schema.orderItems.productId, item.productId),
              inArray(schema.orders.status, ['new', 'confirmed', 'in_production'])
            )
          );
        
        const totalReserved = totalReservedResult[0]?.total_reserved || 0;
        const availableStock = Math.max(0, stock.currentStock - totalReserved);
        quantityToReserve = Math.min(availableStock, item.quantity);

        if (quantityToReserve > 0) {
          // Reserve available stock
          await db.update(schema.stock)
            .set({
              reservedStock: stock.reservedStock + quantityToReserve,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, item.productId));

          // Update order item with reserved quantity
          await db.update(schema.orderItems)
            .set({ reservedQuantity: quantityToReserve })
            .where(and(
              eq(schema.orderItems.orderId, orderId),
              eq(schema.orderItems.productId, item.productId)
            ));

          // Log stock movement
          await db.insert(schema.stockMovements).values({
            productId: item.productId,
            movementType: 'reservation',
            quantity: quantityToReserve,
            referenceId: orderId,
            referenceType: 'order',
            userId: currentUserId
          });
        }
      }

      // Check if there's a shortage and add to production queue
      const shortage = item.quantity - quantityToReserve;
      if (shortage > 0) {
        itemsNeedingProduction.push({
          productId: item.productId,
          quantity: shortage
        });
      }
    }

    // Анализируем доступность товаров и автоматически определяем статус заказа
    const availabilityAnalysis = await analyzeOrderAvailability(orderId);
    
    // Обновляем статус заказа на основе анализа
    await db.update(schema.orders)
      .set({ status: availabilityAnalysis.status })
      .where(eq(schema.orders.id, orderId));

    // Предлагаем производственные задания для товаров с дефицитом
    const suggestedTasks = [];
    if (availabilityAnalysis.should_suggest_production) {
      const taskPriority = priority === 'urgent' ? 5 : 
                          priority === 'high' ? 4 : 
                          priority === 'normal' ? 3 : 2;

      const itemsNeedingProduction = availabilityAnalysis.items.filter(
        item => item.shortage > 0
      );

      for (const item of itemsNeedingProduction) {
        const task = await db.insert(schema.productionTasks).values({
          orderId,
          productId: item.product_id,
          requestedQuantity: item.shortage,
          priority: taskPriority,
          status: 'pending',
          createdBy: currentUserId,
          notes: `Автоматически создано для заказа ${orderNumber}. Дефицит: ${item.shortage} шт.`
        }).returning();
        
        suggestedTasks.push(task[0]);
      }
    }

    // Get complete order data
    const completeOrder = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        items: {
          with: {
            product: true
          }
        }
      }
    });

    // Сообщение зависит от статуса и наличия предложенных заданий
    let message = 'Заказ создан';
    if (availabilityAnalysis.status === 'confirmed') {
      message = 'Заказ создан и подтвержден - все товары в наличии';
    } else if (availabilityAnalysis.status === 'in_production') {
      message = 'Заказ создан - товары уже производятся';
    } else if (suggestedTasks.length > 0) {
      message = `Заказ создан. Предложено ${suggestedTasks.length} производственных заданий для дефицитных товаров`;
    }

    res.status(201).json({
      success: true,
      data: {
        ...completeOrder,
        status: availabilityAnalysis.status // обновляем статус в ответе
      },
      availabilityAnalysis: {
        status: availabilityAnalysis.status,
        can_be_fulfilled: availabilityAnalysis.can_be_fulfilled,
        total_items: availabilityAnalysis.total_items,
        available_items: availabilityAnalysis.available_items,
        needs_production_items: availabilityAnalysis.needs_production_items
      },
      suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : undefined,
      message
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id - Update order
router.put('/:id', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { 
      customerName, 
      customerContact, 
      contractNumber, // Номер договора
      deliveryDate, 
      priority, 
      notes,
      items,
      managerId // Добавляем возможность изменить менеджера
    } = req.body;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    // Check if order exists and user has access
    let whereCondition;
    if (currentUserRole === 'manager') {
      whereCondition = and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.managerId, currentUserId)
      );
    } else {
      whereCondition = eq(schema.orders.id, orderId);
    }

    const existingOrder = await db.query.orders.findFirst({
      where: whereCondition,
      with: {
        items: true
      }
    });

    if (!existingOrder) {
      return next(createError('Order not found', 404));
    }

    // Check if order can be edited
    const nonEditableStatuses = ['completed', 'cancelled'];
    if (existingOrder.status && nonEditableStatuses.includes(existingOrder.status)) {
      return next(createError('Order cannot be edited in current status', 400));
    }

    // Проверяем права на изменение менеджера
    if (managerId && managerId !== existingOrder.managerId) {
      if (currentUserRole !== 'director') {
        return next(createError('Только директор может изменять назначенного менеджера', 403));
      }
      
      // Проверяем, что новый менеджер существует и активен
      const targetManager = await db.query.users.findFirst({
        where: and(
          eq(schema.users.id, managerId),
          eq(schema.users.isActive, true)
        )
      });
      
      if (!targetManager) {
        return next(createError('Указанный менеджер не найден или неактивен', 404));
      }
    }

    // Calculate new total amount
    let totalAmount = 0;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.price && item.quantity) {
          totalAmount += Number(item.price) * Number(item.quantity);
        }
      }
    }

    // Update order
    const updateData: any = {
      updatedAt: new Date()
    };

    if (customerName) updateData.customerName = customerName;
    if (customerContact !== undefined) updateData.customerContact = customerContact || '';
    if (contractNumber !== undefined) updateData.contractNumber = contractNumber || ''; // Номер договора
    if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
    if (priority) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes || '';
    if (totalAmount > 0) updateData.totalAmount = totalAmount.toString();
    if (managerId && managerId !== existingOrder.managerId) updateData.managerId = managerId;

    const updatedOrder = await db.update(schema.orders)
      .set(updateData)
      .where(eq(schema.orders.id, orderId))
      .returning();

    // Update order items if provided
    if (items && Array.isArray(items)) {
      // Remove existing items and their reservations
      const existingItems = existingOrder.items || [];
      
      for (const existingItem of existingItems) {
        // Release reservations
        const reservedQty = existingItem.reservedQuantity || 0;
        if (reservedQty > 0) {
          await db.update(schema.stock)
            .set({
              reservedStock: sql`${schema.stock.reservedStock} - ${reservedQty}`,
              updatedAt: new Date()
            })
            .where(eq(schema.stock.productId, existingItem.productId));

          // Log reservation release
          await db.insert(schema.stockMovements).values({
            productId: existingItem.productId,
            movementType: 'release_reservation',
            quantity: -reservedQty,
            referenceId: orderId,
            referenceType: 'order',
            userId: currentUserId
          });
        }
      }

      // Delete existing items
      await db.delete(schema.orderItems)
        .where(eq(schema.orderItems.orderId, orderId));

      // Create new items and reserve stock
      for (const item of items) {
        // Create order item
        const newOrderItem = await db.insert(schema.orderItems).values({
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price.toString()
        }).returning();

        // Check stock availability and reserve
        const stock = await db.query.stock.findFirst({
          where: eq(schema.stock.productId, item.productId)
        });

        if (stock) {
          const availableStock = stock.currentStock - stock.reservedStock;
          const quantityToReserve = Math.min(availableStock, item.quantity);

          if (quantityToReserve > 0) {
            // Reserve available stock
            await db.update(schema.stock)
              .set({
                reservedStock: stock.reservedStock + quantityToReserve,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, item.productId));

            // Update order item with reserved quantity
            await db.update(schema.orderItems)
              .set({ reservedQuantity: quantityToReserve })
              .where(eq(schema.orderItems.id, newOrderItem[0].id));

            // Log stock movement
            await db.insert(schema.stockMovements).values({
              productId: item.productId,
              movementType: 'reservation',
              quantity: quantityToReserve,
              referenceId: orderId,
              referenceType: 'order',
              userId: currentUserId
            });
          }
        }
      }
    }

    // Add message about order update
    await db.insert(schema.orderMessages).values({
      orderId,
      userId: currentUserId,
      message: 'Заказ был отредактирован'
    });

    // Get complete updated order
    const completeOrder = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        manager: {
          columns: {
            passwordHash: false
          }
        },
        items: {
          with: {
            product: {
              with: {
                stock: true,
                category: true
              }
            }
          }
        },
        messages: {
          with: {
            user: {
              columns: {
                passwordHash: false
              }
            }
          },
          orderBy: sql`${schema.orderMessages.createdAt} ASC`
        }
      }
    });

    res.json({
      success: true,
      data: completeOrder
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id/confirm - Confirm order (move from 'new' to 'confirmed')
router.put('/:id/confirm', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { comment } = req.body;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    // Check if order exists and user has access
    let whereCondition;
    if (currentUserRole === 'manager') {
      whereCondition = and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.managerId, currentUserId)
      );
    } else {
      whereCondition = eq(schema.orders.id, orderId);
    }

    const existingOrder = await db.query.orders.findFirst({
      where: whereCondition,
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

    if (!existingOrder) {
      return next(createError('Order not found', 404));
    }

    // Check if order can be confirmed (only new orders)
    if (existingOrder.status !== 'new') {
      return next(createError(`Cannot confirm order with status '${existingOrder.status}'`, 400));
    }

    // Check if all items have sufficient stock or are already in production queue
    let needsProduction = false;
    const itemsNeedingProduction = [];

    for (const item of existingOrder.items) {
      const stock = item.product.stock;
      const availableStock = stock ? (stock.currentStock - stock.reservedStock) : 0;
      const shortage = item.quantity - (item.reservedQuantity || 0);

      if (shortage > 0) {
        needsProduction = true;
        itemsNeedingProduction.push({
          productId: item.productId,
          quantity: shortage
        });
      }
    }

    // Determine target status
    const targetStatus = needsProduction ? 'in_production' : 'confirmed';

    // Update order status
    const updatedOrder = await db.update(schema.orders)
      .set({
        status: targetStatus,
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    // Add items to production queue if needed
    if (needsProduction && itemsNeedingProduction.length > 0) {
      const productionItems = itemsNeedingProduction.map(item => ({
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        priority: existingOrder.priority === 'urgent' ? 5 : 
                 existingOrder.priority === 'high' ? 4 : 
                 existingOrder.priority === 'normal' ? 3 : 2,
        status: 'queued' as const,
        notes: `Автоматически добавлено при подтверждении заказа ${existingOrder.orderNumber}`
      }));

      await db.insert(schema.productionQueue).values(productionItems);
    }

    // Add message about confirmation
    const message = comment ? 
      `Заказ подтвержден. ${comment}` : 
      `Заказ подтвержден. Статус: ${targetStatus === 'in_production' ? 'отправлен в производство' : 'готов к обработке'}`;

    await db.insert(schema.orderMessages).values({
      orderId,
      userId: currentUserId,
      message
    });

    res.json({
      success: true,
      data: updatedOrder[0],
      message: targetStatus === 'in_production' ? 
        'Заказ подтвержден и отправлен в производство' : 
        'Заказ подтвержден'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { status, comment } = req.body;
    const currentUserId = req.user!.id;

    if (!status) {
      return next(createError('Status is required', 400));
    }

    // Get existing order with items for processing reservations
    const existingOrder = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        items: true
      }
    });

    if (!existingOrder) {
      return next(createError('Order not found', 404));
    }

    // Handle reservation release for completed/cancelled orders
    const statusesRequiringReservationRelease = ['completed', 'cancelled'];
    const statusesRequiringStockReduction = ['completed'];
    
    if (statusesRequiringReservationRelease.includes(status) && existingOrder.status !== status) {
      const orderItems = existingOrder.items || [];
      
      for (const item of orderItems) {
        const reservedQty = item.reservedQuantity || 0;
        
        if (reservedQty > 0) {
          if (statusesRequiringStockReduction.includes(status)) {
            // For completed: reduce both reserved and current stock
            await db.update(schema.stock)
              .set({
                currentStock: sql`${schema.stock.currentStock} - ${reservedQty}`,
                reservedStock: sql`${schema.stock.reservedStock} - ${reservedQty}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, item.productId));

            // Log outgoing movement
            await db.insert(schema.stockMovements).values({
              productId: item.productId,
              movementType: 'outgoing',
              quantity: -reservedQty,
              referenceId: orderId,
              referenceType: 'order',
              comment: `Отгрузка по заказу ${existingOrder.orderNumber}`,
              userId: currentUserId
            });
          } else {
            // For cancelled: only release reservation
            await db.update(schema.stock)
              .set({
                reservedStock: sql`${schema.stock.reservedStock} - ${reservedQty}`,
                updatedAt: new Date()
              })
              .where(eq(schema.stock.productId, item.productId));

            // Log reservation release
            await db.insert(schema.stockMovements).values({
              productId: item.productId,
              movementType: 'release_reservation',
              quantity: -reservedQty,
              referenceId: orderId,
              referenceType: 'order',
              comment: `Отмена резерва по заказу ${existingOrder.orderNumber}`,
              userId: currentUserId
            });
          }
        }
      }
    }

    const updatedOrder = await db.update(schema.orders)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    if (!updatedOrder.length) {
      return next(createError('Order not found', 404));
    }

    // Add message about status change
    const statusMessages: Record<string, string> = {
              'completed': 'Заказ выполнен',
      'cancelled': 'Заказ отменен',
      'ready': 'Заказ готов к отгрузке'
    };

    const defaultMessage = statusMessages[status] || `Status changed to ${status}`;
    const message = comment ? `${defaultMessage}. ${comment}` : defaultMessage;

    await db.insert(schema.orderMessages).values({
      orderId,
      userId: currentUserId,
      message
    });

    res.json({
      success: true,
      data: updatedOrder[0],
      message: statusesRequiringReservationRelease.includes(status) ? 
        'Статус заказа обновлен, резерв товаров снят' : 
        'Статус заказа обновлен'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/messages - Add message to order
router.post('/:id/messages', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { message } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return next(createError('Message is required', 400));
    }

    const newMessage = await db.insert(schema.orderMessages).values({
      orderId,
      userId,
      message
    }).returning();

    // Get message with user data
    const messageWithUser = await db.query.orderMessages.findFirst({
      where: eq(schema.orderMessages.id, newMessage[0].id),
      with: {
        user: {
          columns: {
            passwordHash: false
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: messageWithUser
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/recalculate-statuses - Recalculate all order statuses
router.post('/recalculate-statuses', authenticateToken, authorizeRoles('director'), async (req: AuthRequest, res, next) => {
  try {
    const { recalculateAllOrderStatuses } = await import('../utils/orderStatusCalculator');
    await recalculateAllOrderStatuses();

    res.json({
      success: true,
      message: '✅ ИСПРАВЛЕНА ЛОГИКА СТАТУСОВ: Статусы всех заказов пересчитаны с новой логикой приоритета готовности товаров. Ненужные производственные задания отменены автоматически.'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/analyze-availability - Analyze order availability (for testing)
router.post('/:id/analyze-availability', authenticateToken, authorizeRoles('director', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { analyzeOrderAvailability, cancelUnnecessaryProductionTasks } = await import('../utils/orderStatusCalculator');
    
    const analysis = await analyzeOrderAvailability(orderId);
    const cancelled = await cancelUnnecessaryProductionTasks(orderId);

    res.json({
      success: true,
      data: {
        analysis,
        cancelled_tasks: cancelled
      },
      message: `Анализ завершен. Статус: ${analysis.status}. Отменено заданий: ${cancelled.cancelled}`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id/availability - Get order availability analysis
router.get('/:id/availability', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const analysis = await analyzeOrderAvailability(orderId);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/orders/:id - Delete order (cancel with reservation release)
router.delete('/:id', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    // Check if order exists and user has access
    let whereCondition;
    if (currentUserRole === 'manager') {
      whereCondition = and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.managerId, currentUserId)
      );
    } else {
      whereCondition = eq(schema.orders.id, orderId);
    }

    const existingOrder = await db.query.orders.findFirst({
      where: whereCondition,
      with: {
        items: true
      }
    });

    if (!existingOrder) {
      return next(createError('Order not found', 404));
    }

    // Check if order can be deleted (only new, confirmed, or in_production orders)
    const deletableStatuses = ['new', 'confirmed', 'in_production'];
    if (existingOrder.status && !deletableStatuses.includes(existingOrder.status)) {
      return next(createError(`Cannot delete order with status '${existingOrder.status}'`, 400));
    }

    // Release all reservations
    const orderItems = existingOrder.items || [];
    for (const item of orderItems) {
      const reservedQty = item.reservedQuantity || 0;
      if (reservedQty > 0) {
        await db.update(schema.stock)
          .set({
            reservedStock: sql`${schema.stock.reservedStock} - ${reservedQty}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, item.productId));

        // Log reservation release
        await db.insert(schema.stockMovements).values({
          productId: item.productId,
          movementType: 'release_reservation',
          quantity: -reservedQty,
          referenceId: orderId,
          referenceType: 'order',
          userId: currentUserId
        });
      }
    }

    // Log order deletion for audit
    await db.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      operation: 'DELETE',
      oldValues: existingOrder,
      userId: currentUserId
    });

    // Delete production queue items related to this order
    await db.delete(schema.productionQueue)
      .where(eq(schema.productionQueue.orderId, orderId));

    // Delete order messages
    await db.delete(schema.orderMessages)
      .where(eq(schema.orderMessages.orderId, orderId));

    // Отвязываем производственные задания от заказа (задания остаются, но без привязки к заказу)
    await db.update(schema.productionTasks)
      .set({ 
        orderId: null,
        notes: sql`COALESCE(${schema.productionTasks.notes}, '') || ' | Отвязано от заказа при его удалении'`
      })
      .where(eq(schema.productionTasks.orderId, orderId));

    // Delete order items
    await db.delete(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    // Delete order
    await db.delete(schema.orders)
      .where(eq(schema.orders.id, orderId));

    res.json({
      success: true,
      message: `Заказ ${existingOrder.orderNumber} успешно удален`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/by-product/:productId - Get orders by product
router.get('/by-product/:productId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const userRole = req.user!.role;
    const userId = req.user!.id;

    if (isNaN(productId) || productId <= 0) {
      return next(createError('Некорректный ID товара', 400));
    }

    // Получаем заказы где используется данный товар (только активные)
    let whereConditions = [
      sql`EXISTS (
        SELECT 1 FROM order_items oi 
        WHERE oi.order_id = ${schema.orders.id} 
        AND oi.product_id = ${productId}
      )`,
      inArray(schema.orders.status, ['new', 'confirmed', 'in_production'])
    ];

    // Role-based filtering
    if (userRole === 'manager') {
      whereConditions.push(eq(schema.orders.managerId, userId));
    }

    const orders = await db.query.orders.findMany({
      where: and(...whereConditions),
      with: {
        manager: {
          columns: {
            passwordHash: false
          }
        },
        items: {
          where: eq(schema.orderItems.productId, productId),
          with: {
            product: {
              with: {
                stock: true
              }
            }
          }
        }
      },
      orderBy: sql`${schema.orders.createdAt} DESC`,
      limit: 50
    });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/export - Export orders to Excel (Задача 9.2)
router.post('/export', authenticateToken, requireExportPermission('orders'), async (req: AuthRequest, res, next) => {
  try {
    const { filters, format = 'xlsx' } = req.body; // добавляем параметр format
    const userRole = req.user!.role;
    const userId = req.user!.id;

    let whereConditions: any[] = [];

    // Role-based filtering
    if (userRole === 'manager') {
      whereConditions.push(eq(schema.orders.managerId, userId));
    }

    // Применяем фильтры если они переданы
    if (filters) {
      if (filters.status) {
        const statusArray = filters.status.split(',').map((s: string) => s.trim());
        if (statusArray.length === 1) {
          whereConditions.push(eq(schema.orders.status, statusArray[0] as any));
        } else {
          whereConditions.push(inArray(schema.orders.status, statusArray as any[]));
        }
      }

      if (filters.priority && filters.priority !== 'all') {
        whereConditions.push(eq(schema.orders.priority, filters.priority));
      }

      if (filters.managerId && userRole === 'director') {
        whereConditions.push(eq(schema.orders.managerId, parseInt(filters.managerId)));
      }

      if (filters.search) {
        whereConditions.push(
          sql`(
            ${schema.orders.orderNumber} ILIKE ${`%${filters.search}%`} OR
            ${schema.orders.customerName} ILIKE ${`%${filters.search}%`} OR
            ${schema.orders.customerContact} ILIKE ${`%${filters.search}%`}
          )`
        );
      }

      if (filters.dateFrom) {
        whereConditions.push(sql`${schema.orders.createdAt} >= ${filters.dateFrom}`);
      }

      if (filters.dateTo) {
        whereConditions.push(sql`${schema.orders.createdAt} <= ${filters.dateTo}`);
      }
    }

    // Получаем заказы с полной информацией
    const orders = await db.query.orders.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        items: {
          with: {
            product: true
          }
        },
        manager: true
      },
      orderBy: (orders, { desc }) => [desc(orders.createdAt)]
    });

    // Форматируем данные для Excel
    const formattedData = ExcelExporter.formatOrdersData(orders);

    // Генерируем имя файла
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileExtension = format === 'csv' ? 'csv' : 'xlsx';
    const filename = `orders-export-${timestamp}.${fileExtension}`;

    // Экспортируем в указанном формате (Задача 3: Дополнительные форматы)
    await ExcelExporter.exportData(res, {
      filename,
      sheetName: 'Заказы',
      title: `Экспорт заказов - ${new Date().toLocaleDateString('ru-RU')}`,
      columns: ExcelExporter.getOrdersColumns(),
      data: formattedData,
      format
    });

  } catch (error) {
    next(error);
  }
});

export default router; 