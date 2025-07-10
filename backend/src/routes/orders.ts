import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

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
      whereConditions.push(eq(schema.orders.status, status as any));
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

    res.json({
      success: true,
      data: order
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

    res.status(201).json({
      success: true,
      data: completeOrder
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

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { status, comment } = req.body;
    const userId = req.user!.id;

    if (!status) {
      return next(createError('Status is required', 400));
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
    if (comment) {
      await db.insert(schema.orderMessages).values({
        orderId,
        userId,
        message: `Status changed to ${status}. ${comment}`
      });
    }

    res.json({
      success: true,
      data: updatedOrder[0]
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

export default router; 