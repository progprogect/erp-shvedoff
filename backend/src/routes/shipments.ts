import express from 'express';
import { db, schema } from '../db';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { requireExportPermission } from '../middleware/permissions';
import { createError } from '../middleware/errorHandler';
import { performStockOperation } from '../utils/stockManager';
import { ExcelExporter } from '../utils/excelExporter';
import { updateOrderStatusIfFullyShipped } from '../utils/orderShipmentChecker';

const router = express.Router();

// Функция для проверки и архивации заказа (WBS 2 - Adjustments Задача 5.1)
async function checkAndArchiveOrder(tx: any, orderId: number, userId: number) {
  try {
    // Получаем заказ с его товарами
    const order = await tx.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        items: {
          with: {
            product: true
          }
        }
      }
    });

    if (!order || order.status === 'completed') {
      return; // Заказ уже завершен или не найден
    }

    // Получаем все завершенные отгрузки для этого заказа через shipment_orders
    const completedShipments = await tx.query.shipments.findMany({
      where: and(
        eq(schema.shipments.status, 'completed'),
        sql`EXISTS (
          SELECT 1 FROM shipment_orders so 
          WHERE so.shipment_id = ${schema.shipments.id} 
          AND so.order_id = ${orderId}
        )`
      ),
      with: {
        items: {
          with: {
            product: true
          }
        }
      }
    });

    // Считаем отгруженные количества по каждому товару
    const shippedQuantities: Record<number, number> = {};
    
    for (const shipment of completedShipments) {
      for (const item of shipment.items || []) {
        const productId = item.productId;
        const shippedQty = item.actualQuantity || item.plannedQuantity || 0;
        shippedQuantities[productId] = (shippedQuantities[productId] || 0) + shippedQty;
      }
    }

    // Проверяем - отгружены ли все товары из заказа полностью
    let allItemsShipped = true;
    
    for (const orderItem of order.items) {
      const orderedQty = orderItem.quantity;
      const shippedQty = shippedQuantities[orderItem.productId] || 0;
      
      if (shippedQty < orderedQty) {
        allItemsShipped = false;
        break;
      }
    }

    // Если все товары отгружены - переводим в статус "Отгружен"
    if (allItemsShipped) {
      await tx.update(schema.orders)
        .set({
          status: 'completed',
          updatedAt: new Date()
        })
        .where(eq(schema.orders.id, orderId));

      // Логируем изменение статуса
      await tx.insert(schema.auditLog).values({
        tableName: 'orders',
        recordId: orderId,
        operation: 'UPDATE',
        oldValues: { status: order.status },
        newValues: { 
          status: 'completed',
          reason: 'Автоматическое обновление - все товары отгружены'
        },
        userId
      });

      console.log(`📦 Заказ ${order.orderNumber} автоматически переведен в статус "Отгружен" - все товары отгружены`);
    }
  } catch (error) {
    console.error('Ошибка при проверке архивации заказа:', error);
    // Не прерываем основной поток при ошибке архивации
  }
}

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
        },
        orders: {
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
            }
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

// GET /api/shipments/open - Get open shipments (pending, paused)
router.get('/open', authenticateToken, authorizeRoles('manager', 'director', 'warehouse'), async (req: AuthRequest, res, next) => {
  try {
    const openShipments = await db.query.shipments.findMany({
      where: inArray(schema.shipments.status, ['pending', 'paused']),
      with: {
        orders: {
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
            }
          }
        },
        createdByUser: {
          columns: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: sql`${schema.shipments.createdAt} DESC`
    });

    res.json({
      success: true,
      data: openShipments
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shipments/ready-orders - Get orders ready for shipment
router.get('/ready-orders', authenticateToken, authorizeRoles('manager', 'director', 'warehouse'), async (req: AuthRequest, res, next) => {
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
      .select({ orderId: schema.shipmentOrders.orderId })
      .from(schema.shipmentOrders)
      .innerJoin(schema.shipments, eq(schema.shipmentOrders.shipmentId, schema.shipments.id))
      .where(
        inArray(schema.shipments.status, ['pending', 'paused'])
      );

    const excludeOrderIds = activeShipmentOrders
      .map(item => item.orderId);

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
router.post('/', authenticateToken, authorizeRoles('manager', 'director', 'warehouse'), async (req: AuthRequest, res, next) => {
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

    // Валидируем, что все orderIds являются числами
    const validOrderIds = orderIds.map(id => {
      const numId = Number(id);
      if (isNaN(numId) || numId <= 0) {
        throw new Error(`Некорректный ID заказа: ${id}`);
      }
      return numId;
    });

    // Проверяем, что все заказы готовы к отгрузке
    const orders = await db.query.orders.findMany({
      where: inArray(schema.orders.id, validOrderIds),
      with: {
        items: {
          with: {
            product: true
          }
        }
      }
    });

    if (orders.length !== validOrderIds.length) {
      return next(createError('Некоторые заказы не найдены', 404));
    }

    const invalidOrders = orders.filter(order => order.status !== 'ready');
    if (invalidOrders.length > 0) {
      return next(createError(
        `Заказы не готовы к отгрузке: ${invalidOrders.map(o => o.orderNumber).join(', ')}`, 
        400
      ));
    }

    // Проверяем, что заказы не привязаны к другим активным отгрузкам
    const activeShipmentOrders = await db
      .select({ 
        orderId: schema.shipmentOrders.orderId,
        shipmentNumber: schema.shipments.shipmentNumber
      })
      .from(schema.shipmentOrders)
      .innerJoin(schema.shipments, eq(schema.shipmentOrders.shipmentId, schema.shipments.id))
      .where(
        and(
          inArray(schema.shipmentOrders.orderId, validOrderIds),
          inArray(schema.shipments.status, ['pending', 'paused'])
        )
      );

    if (activeShipmentOrders.length > 0) {
      const conflictingOrders = activeShipmentOrders.map(so => so.orderId);
      const conflictingShipments = activeShipmentOrders.map(so => so.shipmentNumber);
      return next(createError(
        `Заказы уже привязаны к активным отгрузкам: ${conflictingOrders.join(', ')}. Отгрузки: ${conflictingShipments.join(', ')}`, 
        400
      ));
    }

    // Генерируем номер отгрузки
    const shipmentCountResult = await db.select({ count: sql`count(*)` }).from(schema.shipments);
    const shipmentCount = Number(shipmentCountResult[0]?.count || 0);
    const currentYear = new Date().getFullYear();
    const shipmentNumber = `SHIP-${currentYear}-${String(shipmentCount + 1).padStart(3, '0')}`;

    // Создаем отгрузку в транзакции
    const result = await db.transaction(async (tx) => {
      // Создаем отгрузку
      const [newShipment] = await tx.insert(schema.shipments).values({
        shipmentNumber,
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        transportInfo,
        status: 'pending',
        createdBy: userId
      }).returning();

      // Создаем связи между отгрузкой и заказами
      const shipmentOrderLinks = validOrderIds.map(orderId => ({
        shipmentId: newShipment.id,
        orderId: orderId
      }));
      
      if (shipmentOrderLinks.length > 0) {
        await tx.insert(schema.shipmentOrders).values(shipmentOrderLinks);
      }

      // Создаем элементы отгрузки для всех товаров из всех заказов
      const shipmentItems = [];
      for (const order of orders) {
        for (const item of order.items) {
          // Валидируем данные перед вставкой
          const productId = parseInt(String(item.productId), 10);
          const quantity = parseInt(String(item.quantity), 10);
          
          if (!Number.isInteger(productId) || productId <= 0) {
            throw new Error(`Некорректный ID товара: ${item.productId}`);
          }
          
          if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error(`Некорректное количество товара: ${item.quantity}`);
          }
          
          shipmentItems.push({
            shipmentId: newShipment.id,
            productId: productId,
            plannedQuantity: quantity,
            actualQuantity: null
          });
        }
      }

      if (shipmentItems.length > 0) {
        await tx.insert(schema.shipmentItems).values(shipmentItems);
      }

      // Обновляем статус заказов - они остаются ready до фактической отгрузки
      for (const orderId of validOrderIds) {
        await tx.update(schema.orders)
          .set({ status: 'ready' })
          .where(eq(schema.orders.id, orderId));
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
      message: `Отгрузка ${shipmentNumber} создана для ${validOrderIds.length} заказа(ов)`
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
    pendingCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    pausedCount: 0
    };

    // Подсчитываем статистику по статусам
    shipments.forEach(shipment => {
      switch (shipment.status) {
        case 'pending':
          totalStats.pendingCount++;
          break;
        case 'completed':
          totalStats.completedCount++;
          break;
        case 'cancelled':
          totalStats.cancelledCount++;
          break;
        case 'paused':
          totalStats.pausedCount++;
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
    
    if (isNaN(shipmentId) || shipmentId <= 0) {
      return next(createError('Некорректный ID отгрузки', 400));
    }

    const shipment = await db.query.shipments.findFirst({
      where: eq(schema.shipments.id, shipmentId),
      with: {
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
        },
        orders: {
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
            }
          }
        }
      }
    });

    if (!shipment) {
      return next(createError('Отгрузка не найдена', 404));
    }

    // Получаем связанные заказы через shipment_orders
    const relatedOrders = shipment.orders?.map(so => so.order) || [];

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
        orders: {
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
            }
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

    // Валидация переходов статусов
    const validTransitions: Record<string, string[]> = {
      'pending': ['completed', 'cancelled', 'paused'],
      'paused': ['pending', 'cancelled'],
      'completed': [], // финальный статус
      'cancelled': [] // финальный статус
    };

    if (!shipment.status || !validTransitions[shipment.status]?.includes(status)) {
      const currentStatus = shipment.status || 'неизвестно';
      const availableTransitions = shipment.status ? validTransitions[shipment.status]?.join(', ') || 'нет' : 'нет';
      return next(createError(`Невозможно изменить статус с '${currentStatus}' на '${status}'. Доступные переходы: ${availableTransitions}`, 400));
    }

    // Обновляем отгрузку в транзакции
    const result = await db.transaction(async (tx) => {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'completed') {
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

             // При завершении автоматически списываем товары
       if (status === 'completed') {
         console.log(`📦 Начинаем списание товаров для отгрузки ${shipment.shipmentNumber}`);
         
         for (const item of shipment.items || []) {
           const quantityToShip = (actualQuantities && actualQuantities[item.id]) ? Number(actualQuantities[item.id]) : item.plannedQuantity;
           
           console.log(`📦 Товар ${item.product?.name || item.productId}: запланировано ${item.plannedQuantity}, к отгрузке ${quantityToShip}`);
           
           if (quantityToShip > 0) {
             // Получаем текущие остатки товара
             const currentStock = await tx.query.stock.findFirst({
               where: eq(schema.stock.productId, item.productId)
             });

             if (!currentStock) {
               console.error(`❌ Товар ${item.productId} не найден в остатках`);
               continue;
             }

             // Проверяем, что резерва достаточно
             if (quantityToShip > currentStock.reservedStock) {
               console.error(`❌ Недостаточно резерва для товара ${item.productId}: резерв ${currentStock.reservedStock}, требуется ${quantityToShip}`);
               continue;
             }

             // Списываем товар со склада (уменьшаем и общий остаток и резерв)
             await tx.update(schema.stock)
               .set({
                 currentStock: sql`${schema.stock.currentStock} - ${quantityToShip}`,
                 reservedStock: sql`${schema.stock.reservedStock} - ${quantityToShip}`,
                 updatedAt: new Date()
               })
               .where(eq(schema.stock.productId, item.productId));

             // Логируем движение товара
             await tx.insert(schema.stockMovements).values({
               productId: item.productId,
               movementType: 'outgoing',
               quantity: -quantityToShip,
               referenceId: shipmentId,
               referenceType: 'shipment',
               comment: `Отгрузка ${shipment.shipmentNumber}: ${item.product?.name || 'товар'}`,
               userId
             });

             console.log(`✅ Товар ${item.product?.name || item.productId} списан: ${quantityToShip} шт`);
           }
         }
         
         console.log(`📦 Списывание товаров для отгрузки ${shipment.shipmentNumber} завершено`);

        // Умная логика архивации заказов (WBS 2 - Adjustments Задача 5.1)
        // Получаем все заказы, связанные с этой отгрузкой
        const shipmentOrderLinks = await tx.query.shipmentOrders.findMany({
          where: eq(schema.shipmentOrders.shipmentId, shipmentId)
        });
        
        for (const link of shipmentOrderLinks) {
          await checkAndArchiveOrder(tx, link.orderId, userId);
        }
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
       'pending': 'в очереди',
       'completed': 'выполнена',
       'cancelled': 'отменена',
       'paused': 'на паузе'
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
router.put('/:id', authenticateToken, authorizeRoles('manager', 'director', 'warehouse'), async (req: AuthRequest, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    const { plannedDate, transportInfo, documentsPhotos, orderIds } = req.body;
    const userId = req.user!.id;

    const shipment = await db.query.shipments.findFirst({
      where: eq(schema.shipments.id, shipmentId)
    });

    if (!shipment) {
      return next(createError('Отгрузка не найдена', 404));
    }

    // Можно редактировать только ожидающие и на паузе отгрузки
    if (!shipment.status || !['pending', 'paused'].includes(shipment.status)) {
      return next(createError('Нельзя редактировать завершенную или отмененную отгрузку', 400));
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

    // Обновляем shipments только если есть поля для обновления
    let updatedShipment = shipment;
    if (Object.keys(updateData).length > 0) {
      [updatedShipment] = await db.update(schema.shipments)
        .set(updateData)
        .where(eq(schema.shipments.id, shipmentId))
        .returning();
    }

    // Обновляем заказы в отгрузке, если переданы orderIds
    if (orderIds && Array.isArray(orderIds)) {
      // Удаляем существующие связи и товары
      await db.delete(schema.shipmentOrders)
        .where(eq(schema.shipmentOrders.shipmentId, shipmentId));
      
      await db.delete(schema.shipmentItems)
        .where(eq(schema.shipmentItems.shipmentId, shipmentId));

      // Добавляем новые связи и товары
      if (orderIds.length > 0) {
        // Создаем связи между отгрузкой и заказами
        await db.insert(schema.shipmentOrders).values(
          orderIds.map(orderId => ({
            shipmentId,
            orderId,
            createdAt: new Date()
          }))
        );

        // Получаем заказы с товарами для создания shipment_items
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

        // Создаем элементы отгрузки для всех товаров из всех заказов
        const shipmentItems = [];
        for (const order of orders) {
          for (const item of order.items) {
            // Валидируем данные перед вставкой
            const productId = parseInt(String(item.productId), 10);
            const quantity = parseInt(String(item.quantity), 10);
            
            if (!Number.isInteger(productId) || productId <= 0) {
              throw new Error(`Некорректный ID товара: ${item.productId}`);
            }
            
            if (!Number.isInteger(quantity) || quantity <= 0) {
              throw new Error(`Некорректное количество товара: ${item.quantity}`);
            }
            
            shipmentItems.push({
              shipmentId,
              productId: productId,
              plannedQuantity: quantity,
              actualQuantity: null
            });
          }
        }

        if (shipmentItems.length > 0) {
          await db.insert(schema.shipmentItems).values(shipmentItems);
        }
      }
    }

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
router.delete('/:id', authenticateToken, authorizeRoles('manager', 'director', 'warehouse'), async (req: AuthRequest, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    const userId = req.user!.id;

    const shipment = await db.query.shipments.findFirst({
      where: eq(schema.shipments.id, shipmentId)
    });

    if (!shipment) {
      return next(createError('Отгрузка не найдена', 404));
    }

    // Можно отменить только ожидающие отгрузки
    if (shipment.status !== 'pending') {
      return next(createError('Можно отменить только ожидающие отгрузки', 400));
    }

    const result = await db.transaction(async (tx) => {
      // Помечаем отгрузку как отмененную
      const [cancelledShipment] = await tx.update(schema.shipments)
        .set({
          status: 'cancelled'
        })
        .where(eq(schema.shipments.id, shipmentId))
        .returning();

             // Возвращаем все связанные заказы в статус ready
       const shipmentOrderLinks = await tx.query.shipmentOrders.findMany({
         where: eq(schema.shipmentOrders.shipmentId, shipmentId)
       });
       
       for (const link of shipmentOrderLinks) {
         await tx.update(schema.orders)
           .set({
             status: 'ready',
             updatedAt: new Date()
           })
           .where(eq(schema.orders.id, link.orderId));
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

// POST /api/shipments/export - Export shipments to Excel (Задача 9.2)
router.post('/export', authenticateToken, requireExportPermission('shipments'), async (req: AuthRequest, res, next) => {
  try {
    const { filters, format = 'xlsx' } = req.body; // добавляем параметр format

    let whereConditions: any[] = [];

    // Применяем фильтры если они переданы
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        const statusArray = filters.status.split(',').map((s: string) => s.trim());
        if (statusArray.length === 1) {
          whereConditions.push(eq(schema.shipments.status, statusArray[0] as any));
        } else {
          whereConditions.push(inArray(schema.shipments.status, statusArray as any[]));
        }
      }

      if (filters.createdBy && filters.createdBy !== 'all') {
        whereConditions.push(eq(schema.shipments.createdBy, parseInt(filters.createdBy)));
      }

      if (filters.dateFrom) {
        whereConditions.push(sql`${schema.shipments.createdAt} >= ${filters.dateFrom}`);
      }

      if (filters.dateTo) {
        whereConditions.push(sql`${schema.shipments.createdAt} <= ${filters.dateTo}`);
      }
    }

    // Получаем отгрузки с полной информацией
    const shipments = await db.query.shipments.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        orders: {
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
            }
          }
        },
        createdByUser: true,
        items: {
          with: {
            product: true
          }
        }
      },
      orderBy: [desc(schema.shipments.createdAt)]
    });

    // Форматируем данные для Excel
    const formattedData = ExcelExporter.formatShipmentsData(shipments);

    // Генерируем имя файла
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileExtension = format === 'csv' ? 'csv' : 'xlsx';
    const filename = `shipments-export-${timestamp}.${fileExtension}`;

    // Экспортируем в указанном формате (Задача 3: Дополнительные форматы)
    await ExcelExporter.exportData(res, {
      filename,
      sheetName: 'Отгрузки',
      title: `Экспорт отгрузок - ${new Date().toLocaleDateString('ru-RU')}`,
      columns: ExcelExporter.getShipmentsColumns(),
      data: formattedData,
      format
    });

  } catch (error) {
    next(error);
  }
});

export default router; 