import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

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

export default router; 