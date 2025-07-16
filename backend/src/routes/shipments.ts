import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { performStockOperation } from '../utils/stockManager';

const router = express.Router();

// GET /api/shipments - Get shipments list
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { status, limit = 50, offset = 0, search } = req.query;

    let whereConditions = [];

    if (status) {
      whereConditions.push(eq(schema.shipments.status, status as any));
    }

    if (search) {
      whereConditions.push(
        sql`${schema.shipments.shipmentNumber} ILIKE ${`%${search}%`} OR ${schema.orders.orderNumber} ILIKE ${`%${search}%`} OR ${schema.orders.customerName} ILIKE ${`%${search}%`}`
      );
    }

    const shipments = await db.query.shipments.findMany({
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
            },
            items: {
              with: {
                product: true
              }
            }
          }
        },
        createdByUser: {
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
      },
      orderBy: [
        desc(schema.shipments.createdAt)
      ],
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: shipments
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/ready-orders - Get orders ready for shipment
router.get('/ready-orders', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    // Получаем заказы готовые к отгрузке (статус 'ready')
    const readyOrders = await db.query.orders.findMany({
      where: eq(schema.orders.status, 'ready'),
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
      },
      orderBy: [
        asc(schema.orders.deliveryDate),
        desc(schema.orders.createdAt)
      ]
    });

    // Проверяем, какие заказы уже включены в активные отгрузки
    const activeShipmentOrders = await db
      .select({ orderId: schema.shipments.orderId })
      .from(schema.shipments)
      .where(
        and(
          inArray(schema.shipments.status, ['planned', 'loading', 'shipped']),
          sql`${schema.shipments.orderId} IS NOT NULL`
        )
      );

    const excludeOrderIds = activeShipmentOrders
      .map(item => item.orderId)
      .filter(id => id !== null) as number[];

    // Фильтруем заказы, исключая уже включенные в активные отгрузки
    const availableOrders = readyOrders.filter(order => 
      !excludeOrderIds.includes(order.id)
    );

    res.json({
      success: true,
      data: availableOrders
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/shipments - Create new shipment
router.post('/', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const { 
      orderIds, 
      plannedDate, 
      transportInfo, 
      notes 
    } = req.body;
    const userId = req.user!.id;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return next(createError('Необходимо выбрать хотя бы один заказ для отгрузки', 400));
    }

    // Проверяем, что все заказы готовы к отгрузке
    const orders = await db.query.orders.findMany({
      where: inArray(schema.orders.id, orderIds),
      with: {
        items: {
          with: {
            product: true
          }
        }
      }
    });

    if (orders.length !== orderIds.length) {
      return next(createError('Некоторые заказы не найдены', 404));
    }

    const invalidOrders = orders.filter(order => order.status !== 'ready');
    if (invalidOrders.length > 0) {
      return next(createError(
        `Заказы не готовы к отгрузке: ${invalidOrders.map(o => o.orderNumber).join(', ')}`, 
        400
      ));
    }

    // Генерируем номер отгрузки
    const shipmentCountResult = await db.select({ count: sql`count(*)` }).from(schema.shipments);
    const shipmentCount = Number(shipmentCountResult[0]?.count || 0);
    const shipmentNumber = `SHIP-${Date.now()}-${shipmentCount + 1}`;

    // Создаем отгрузку в транзакции
    const result = await db.transaction(async (tx) => {
      // Для множественных заказов создаем одну отгрузку
      const [newShipment] = await tx.insert(schema.shipments).values({
        shipmentNumber,
        orderId: orderIds.length === 1 ? orderIds[0] : null, // Для одного заказа указываем orderId
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        transportInfo,
        status: 'planned',
        createdBy: userId
      }).returning();

      // Создаем элементы отгрузки для всех товаров из всех заказов
      const shipmentItems = [];
      for (const order of orders) {
        for (const item of order.items) {
          shipmentItems.push({
            shipmentId: newShipment.id,
            productId: item.productId,
            plannedQuantity: item.quantity,
            actualQuantity: null
          });
        }
      }

      if (shipmentItems.length > 0) {
        await tx.insert(schema.shipmentItems).values(shipmentItems);
      }

      // Если это одиночная отгрузка, обновляем статус заказа
      if (orderIds.length === 1) {
        await tx.update(schema.orders)
          .set({ status: 'ready' }) // Остается ready до фактической отгрузки
          .where(eq(schema.orders.id, orderIds[0]));
      }

      // Логируем создание отгрузки
      await tx.insert(schema.auditLog).values({
        tableName: 'shipments',
        recordId: newShipment.id,
        operation: 'INSERT',
        newValues: newShipment,
        userId
      });

      return newShipment;
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Отгрузка ${shipmentNumber} создана для ${orderIds.length} заказа(ов)`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/statistics - Get shipments statistics
router.get('/statistics', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // Получаем все отгрузки
    const shipments = await db.query.shipments.findMany({
      columns: {
        id: true,
        status: true,
        createdAt: true
      }
    });
    
    // Инициализируем статистику
    const totalStats = {
      total: shipments.length,
      todayCount: 0,
      thisMonthCount: 0,
      plannedCount: 0,
      shippedCount: 0,
      deliveredCount: 0
    };

    // Подсчитываем статистику по статусам
    shipments.forEach(shipment => {
      switch (shipment.status) {
        case 'planned':
          totalStats.plannedCount++;
          break;
        case 'shipped':
          totalStats.shippedCount++;
          break;
        case 'delivered':
          totalStats.deliveredCount++;
          break;
      }
    });

    // Подсчет за сегодня и месяц с безопасной обработкой дат
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    shipments.forEach(shipment => {
      if (shipment.createdAt) {
        try {
          const createdAt = new Date(shipment.createdAt);
          // Проверяем валидность даты
          if (!isNaN(createdAt.getTime())) {
            if (createdAt >= today) {
              totalStats.todayCount++;
            }
            if (createdAt >= thisMonth) {
              totalStats.thisMonthCount++;
            }
          }
        } catch (e) {
          // Игнорируем невалидные даты
          console.warn('Invalid date in shipment:', shipment.id);
        }
      }
    });

    res.json({
      success: true,
      data: totalStats
    });
  } catch (error) {
    console.error('Error in shipments statistics:', error);
    next(error);
  }
});

// GET /api/shipments/:id - Get shipment details
router.get('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const shipmentId = Number(req.params.id);

    const shipment = await db.query.shipments.findFirst({
      where: eq(schema.shipments.id, shipmentId),
      with: {
        order: {
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
        },
        createdByUser: {
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

    if (!shipment) {
      return next(createError('Отгрузка не найдена', 404));
    }

    // Если отгрузка связана с одним заказом, получаем заказы по другому принципу
    let relatedOrders: any[] = [];
    if (shipment.order) {
      relatedOrders = [shipment.order];
    } else {
      // Для множественных отгрузок получаем все связанные заказы через shipment items
      const productIds = shipment.items?.map(item => item.productId) || [];
      if (productIds.length > 0) {
        relatedOrders = await db.query.orders.findMany({
          where: sql`${schema.orders.status} = 'ready' AND ${schema.orders.id} IN (
            SELECT DISTINCT oi.order_id 
            FROM order_items oi 
            WHERE oi.product_id IN (${productIds.join(',')})
          )`,
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
    }

    res.json({
      success: true,
      data: {
        ...shipment,
        relatedOrders
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/shipments/:id/status - Update shipment status
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    const { status, actualQuantities, transportInfo, documentsPhotos } = req.body;
    const userId = req.user!.id;

    if (!status) {
      return next(createError('Статус обязателен', 400));
    }

    const shipment = await db.query.shipments.findFirst({
      where: eq(schema.shipments.id, shipmentId),
      with: {
        order: true,
        items: {
          with: {
            product: true
          }
        }
      }
    });

    if (!shipment) {
      return next(createError('Отгрузка не найдена', 404));
    }

    // Валидация переходов статусов
    const validTransitions: Record<string, string[]> = {
      'planned': ['loading', 'cancelled'],
      'loading': ['shipped', 'planned'],
      'shipped': ['delivered'],
      'delivered': [], // финальный статус
      'cancelled': [] // финальный статус
    };

    if (!shipment.status || !validTransitions[shipment.status]?.includes(status)) {
      return next(createError(`Невозможно изменить статус с '${shipment.status || 'неизвестно'}' на '${status}'`, 400));
    }

    // Обновляем отгрузку в транзакции
    const result = await db.transaction(async (tx) => {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'shipped' || status === 'delivered') {
        updateData.actualDate = new Date();
      }

      if (transportInfo !== undefined) {
        updateData.transportInfo = transportInfo;
      }

      if (documentsPhotos && Array.isArray(documentsPhotos)) {
        updateData.documentsPhotos = documentsPhotos;
      }

      // Обновляем отгрузку
      const [updatedShipment] = await tx.update(schema.shipments)
        .set(updateData)
        .where(eq(schema.shipments.id, shipmentId))
        .returning();

             // Обновляем фактические количества, если предоставлены
       if (actualQuantities && typeof actualQuantities === 'object') {
         for (const [itemId, quantity] of Object.entries(actualQuantities)) {
           if (itemId && quantity !== null && quantity !== undefined) {
             await tx.update(schema.shipmentItems)
               .set({
                 actualQuantity: Number(quantity)
               })
               .where(eq(schema.shipmentItems.id, Number(itemId)));
           }
         }
       }

             // При отгрузке (shipped) автоматически списываем товары
       if (status === 'shipped') {
         for (const item of shipment.items || []) {
           const quantityToShip = (actualQuantities && actualQuantities[item.id]) ? Number(actualQuantities[item.id]) : item.plannedQuantity;
           
           if (quantityToShip > 0) {
             // Списываем товар со склада
             await performStockOperation({
               productId: item.productId,
               type: 'outgoing',
               quantity: quantityToShip,
               userId,
               comment: `Отгрузка ${shipment.shipmentNumber}: ${item.product?.name || 'товар'}`
             });
           }
         }

        // Если отгрузка связана с конкретным заказом, обновляем его статус
        if (shipment.orderId) {
          await tx.update(schema.orders)
            .set({
              status: 'shipped',
              updatedAt: new Date()
            })
            .where(eq(schema.orders.id, shipment.orderId));
        }
      }

      // При доставке обновляем статус заказа
      if (status === 'delivered' && shipment.orderId) {
        await tx.update(schema.orders)
          .set({
            status: 'delivered',
            updatedAt: new Date()
          })
          .where(eq(schema.orders.id, shipment.orderId));
      }

      // Логируем изменение
      await tx.insert(schema.auditLog).values({
        tableName: 'shipments',
        recordId: shipmentId,
        operation: 'UPDATE',
        oldValues: { status: shipment.status },
        newValues: { status },
        userId
      });

      return updatedShipment;
    });

         const statusTextMap: Record<string, string> = {
       'loading': 'загрузка',
       'shipped': 'отгружена',
       'delivered': 'доставлена',
       'cancelled': 'отменена'
     };
     const statusText = statusTextMap[status] || status;

    res.json({
      success: true,
      data: result,
      message: `Статус отгрузки изменен на "${statusText}"`
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/shipments/:id - Update shipment details
router.put('/:id', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    const { plannedDate, transportInfo, documentsPhotos } = req.body;
    const userId = req.user!.id;

    const shipment = await db.query.shipments.findFirst({
      where: eq(schema.shipments.id, shipmentId)
    });

    if (!shipment) {
      return next(createError('Отгрузка не найдена', 404));
    }

    // Можно редактировать только запланированные и загружаемые отгрузки
    if (!shipment.status || !['planned', 'loading'].includes(shipment.status)) {
      return next(createError('Нельзя редактировать отгруженную или доставленную отгрузку', 400));
    }

    const updateData: any = {};

    if (plannedDate !== undefined) {
      updateData.plannedDate = plannedDate ? new Date(plannedDate) : null;
    }

    if (transportInfo !== undefined) {
      updateData.transportInfo = transportInfo;
    }

    if (documentsPhotos !== undefined) {
      updateData.documentsPhotos = documentsPhotos;
    }

    const [updatedShipment] = await db.update(schema.shipments)
      .set(updateData)
      .where(eq(schema.shipments.id, shipmentId))
      .returning();

    // Логируем изменение
    await db.insert(schema.auditLog).values({
      tableName: 'shipments',
      recordId: shipmentId,
      operation: 'UPDATE',
      oldValues: shipment,
      newValues: updatedShipment,
      userId
    });

    res.json({
      success: true,
      data: updatedShipment,
      message: 'Отгрузка обновлена'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/shipments/:id - Cancel shipment
router.delete('/:id', authenticateToken, authorizeRoles('manager', 'director'), async (req: AuthRequest, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    const userId = req.user!.id;

    const shipment = await db.query.shipments.findFirst({
      where: eq(schema.shipments.id, shipmentId),
      with: {
        order: true
      }
    });

    if (!shipment) {
      return next(createError('Отгрузка не найдена', 404));
    }

    // Можно отменить только запланированные отгрузки
    if (shipment.status !== 'planned') {
      return next(createError('Можно отменить только запланированные отгрузки', 400));
    }

    const result = await db.transaction(async (tx) => {
      // Помечаем отгрузку как отмененную
      const [cancelledShipment] = await tx.update(schema.shipments)
        .set({
          status: 'cancelled'
        })
        .where(eq(schema.shipments.id, shipmentId))
        .returning();

             // Если отгрузка была связана с заказом, возвращаем заказ в статус ready
       if (shipment.orderId && shipment.order && shipment.order.status === 'ready') {
         await tx.update(schema.orders)
           .set({
             status: 'ready',
             updatedAt: new Date()
           })
           .where(eq(schema.orders.id, shipment.orderId));
       }

      // Логируем отмену
      await tx.insert(schema.auditLog).values({
        tableName: 'shipments',
        recordId: shipmentId,
        operation: 'UPDATE',
        oldValues: { status: shipment.status },
        newValues: { status: 'cancelled' },
        userId
      });

      return cancelledShipment;
    });

    res.json({
      success: true,
      data: result,
      message: 'Отгрузка отменена'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 