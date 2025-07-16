import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { performStockOperation } from '../utils/stockManager';
import { analyzeOrderAvailability, updateOrderStatus } from '../utils/orderStatusCalculator.js';

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

    res.json({
      success: true,
      data: orders
    });
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

    // Helper function to calculate production quantity for products
    async function getProductionQuantities(productIds: number[]) {
      if (productIds.length === 0) {
        return new Map<number, number>();
      }

      const tasksQuery = db
        .select({
          productId: schema.productionTasks.productId,
          quantity: sql<number>`
            SUM(
              CASE 
                WHEN ${schema.productionTasks.status} IN ('approved', 'in_progress') 
                THEN COALESCE(${schema.productionTasks.approvedQuantity}, ${schema.productionTasks.requestedQuantity})
                ELSE 0
              END
            )
          `.as('quantity')
        })
        .from(schema.productionTasks)
        .where(
          and(
            inArray(schema.productionTasks.status, ['approved', 'in_progress']),
            inArray(schema.productionTasks.productId, productIds)
          )
        )
        .groupBy(schema.productionTasks.productId);

      const inProduction = await tasksQuery;
      const productionMap = new Map<number, number>();

      inProduction.forEach(item => {
        productionMap.set(item.productId, item.quantity);
      });

      return productionMap;
    }

    // Helper function to calculate reserved quantities from active orders
    async function getReservedQuantities(productIds: number[]) {
      if (productIds.length === 0) {
        return new Map<number, number>();
      }

      const reservedQuery = db
        .select({
          productId: schema.orderItems.productId,
          quantity: sql<number>`SUM(${schema.orderItems.quantity})`.as('quantity')
        })
        .from(schema.orderItems)
        .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
        .where(
          and(
            inArray(schema.orderItems.productId, productIds),
            inArray(schema.orders.status, ['new', 'confirmed', 'in_production', 'shipped'])
          )
        )
        .groupBy(schema.orderItems.productId);

      const reservedData = await reservedQuery;
      const reservedMap = new Map<number, number>();

      reservedData.forEach(item => {
        reservedMap.set(item.productId, item.quantity);
      });

      return reservedMap;
    }

    // Получаем ID всех продуктов в заказе
    const productIds = order.items?.map(item => item.productId) || [];
    
    // Получаем данные о производстве и резервах
    const [productionQuantities, reservedQuantities] = await Promise.all([
      getProductionQuantities(productIds),
      getReservedQuantities(productIds)
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
      deliveryDate, 
      priority = 'normal', 
      items, 
      notes 
    } = req.body;
    const managerId = req.user!.id;

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return next(createError('Customer name and items are required', 400));
    }

    // Generate order number
    const orderCountResult = await db.select({ count: sql`count(*)` }).from(schema.orders);
    const orderCount = Number(orderCountResult[0]?.count || 0);
    const orderNumber = `ORD-${Date.now()}-${orderCount + 1}`;

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      if (item.price && item.quantity) {
        totalAmount += Number(item.price) * Number(item.quantity);
      }
    }

    // Create order
    const newOrder = await db.insert(schema.orders).values({
      orderNumber,
      customerName,
      customerContact,
      status: 'new',
      priority,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      managerId,
      totalAmount: totalAmount.toString(),
      notes
    }).returning();

    const orderId = newOrder[0].id;

    // Create order items and check/reserve stock
    const itemsNeedingProduction = [];
    
    for (const item of items) {
      // Create order item
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
        const availableStock = stock.currentStock - stock.reservedStock;
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
            userId: managerId
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
          status: 'suggested',
          suggestedBy: managerId,
          notes: `Автоматически предложено для заказа ${orderNumber}. Дефицит: ${item.shortage} шт.`
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
      deliveryDate, 
      priority, 
      notes,
      items 
    } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if order exists and user has access
    let whereCondition;
    if (userRole === 'manager') {
      whereCondition = and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.managerId, userId)
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
    const nonEditableStatuses = ['shipped', 'delivered', 'cancelled'];
    if (existingOrder.status && nonEditableStatuses.includes(existingOrder.status)) {
      return next(createError('Order cannot be edited in current status', 400));
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
    if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
    if (priority) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes || '';
    if (totalAmount > 0) updateData.totalAmount = totalAmount.toString();

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
            userId
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
              userId
            });
          }
        }
      }
    }

    // Add message about order update
    await db.insert(schema.orderMessages).values({
      orderId,
      userId,
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
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if order exists and user has access
    let whereCondition;
    if (userRole === 'manager') {
      whereCondition = and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.managerId, userId)
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
      userId,
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
    const userId = req.user!.id;

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
    const statusesRequiringReservationRelease = ['shipped', 'delivered', 'cancelled'];
    const statusesRequiringStockReduction = ['shipped', 'delivered'];
    
    if (statusesRequiringReservationRelease.includes(status) && existingOrder.status !== status) {
      const orderItems = existingOrder.items || [];
      
      for (const item of orderItems) {
        const reservedQty = item.reservedQuantity || 0;
        
        if (reservedQty > 0) {
          if (statusesRequiringStockReduction.includes(status)) {
            // For shipped/delivered: reduce both reserved and current stock
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
              userId
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
              userId
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
      'shipped': 'Заказ отгружен',
      'delivered': 'Заказ доставлен',
      'cancelled': 'Заказ отменен',
      'ready': 'Заказ готов к отгрузке'
    };

    const defaultMessage = statusMessages[status] || `Status changed to ${status}`;
    const message = comment ? `${defaultMessage}. ${comment}` : defaultMessage;

    await db.insert(schema.orderMessages).values({
      orderId,
      userId,
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
    const { recalculateAllOrderStatuses } = await import('../utils/orderStatusCalculator.js');
    await recalculateAllOrderStatuses();

    res.json({
      success: true,
      message: 'Статусы всех заказов пересчитаны на основе актуальной доступности товаров'
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
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if order exists and user has access
    let whereCondition;
    if (userRole === 'manager') {
      whereCondition = and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.managerId, userId)
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
          userId
        });
      }
    }

    // Log order deletion for audit
    await db.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      operation: 'DELETE',
      oldValues: existingOrder,
      userId,
      createdAt: new Date()
    });

    // Delete production queue items related to this order
    await db.delete(schema.productionQueue)
      .where(eq(schema.productionQueue.orderId, orderId));

    // Delete order messages
    await db.delete(schema.orderMessages)
      .where(eq(schema.orderMessages.orderId, orderId));

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

export default router; 