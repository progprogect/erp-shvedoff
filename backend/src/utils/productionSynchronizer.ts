import { db } from '../db/index.js';
import { productionQueue, productionTasks, orders, orderMessages, stock, stockMovements, productionTaskExtras } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export interface SyncResult {
  migrated: number;
  existing: number;
  errors: string[];
}

/**
 * Синхронизирует элементы из production_queue в production_tasks
 * Конвертирует старую систему в новую без потери данных
 */
export async function syncProductionQueueToTasks(): Promise<SyncResult> {
  const result: SyncResult = {
    migrated: 0,
    existing: 0,
    errors: []
  };

  try {
    // Получаем все элементы из production_queue, которые еще не мигрированы
    const queueItems = await db
      .select({
        id: productionQueue.id,
        orderId: productionQueue.orderId,
        productId: productionQueue.productId,
        quantity: productionQueue.quantity,
        priority: productionQueue.priority,
        status: productionQueue.status,
        notes: productionQueue.notes,
        createdAt: productionQueue.createdAt,
        actualStartDate: productionQueue.actualStartDate,
        actualCompletionDate: productionQueue.actualCompletionDate
      })
      .from(productionQueue);

    for (const item of queueItems) {
      try {
        // Проверяем, существует ли уже соответствующая задача
        const existingTask = await db
          .select({ id: productionTasks.id })
          .from(productionTasks)
          .where(
            and(
              eq(productionTasks.orderId, item.orderId || 0),
              eq(productionTasks.productId, item.productId),
              eq(productionTasks.requestedQuantity, item.quantity)
            )
          )
          .limit(1);

        if (existingTask.length > 0) {
          result.existing++;
          continue;
        }

        // Конвертируем статус из старой системы в новую
        let newStatus: 'pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
        
        switch (item.status) {
          case 'queued':
            newStatus = 'pending'; // очередь = готово к работе
            break;
          case 'in_progress':
            newStatus = 'in_progress';
            break;
          case 'completed':
            newStatus = 'completed';
            break;
          case 'cancelled':
            newStatus = 'cancelled';
            break;
          default:
            newStatus = 'pending';
        }

        // Создаем новую задачу на основе элемента очереди
        const newTask = {
          orderId: item.orderId || 0,
          productId: item.productId,
          requestedQuantity: item.quantity,
          status: newStatus,
          priority: item.priority || 3,
          sortOrder: 0,
          
          // Проставляем даты на основе статуса
          createdAt: item.createdAt || new Date(),
          startedAt: item.actualStartDate,
          completedAt: item.actualCompletionDate,
          
          // Дополнительные поля
          notes: `Мигрировано из production_queue #${item.id}${item.notes ? ` | ${item.notes}` : ''}`,
          createdBy: 1, // системный пользователь
          startedBy: item.actualStartDate ? 1 : null,
          completedBy: item.actualCompletionDate ? 1 : null
        };

        await db.insert(productionTasks).values(newTask);
        result.migrated++;

      } catch (error) {
        result.errors.push(`Ошибка миграции элемента ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    result.errors.push(`Общая ошибка синхронизации: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Создает задачи для заказов без достаточных остатков
 * Автоматически предлагает производственные задания для всех активных заказов
 */
export async function createTasksForPendingOrders(): Promise<SyncResult> {
  const result: SyncResult = {
    migrated: 0,
    existing: 0,
    errors: []
  };

  try {
    // Получаем все активные заказы (включая те, что уже в производстве)
    const activeOrders = await db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        priority: orders.priority,
        deliveryDate: orders.deliveryDate,
        status: orders.status
      })
      .from(orders)
      .where(sql`${orders.status} IN ('new', 'confirmed', 'in_production')`);

    // Получаем все существующие активные задания для оптимизации запросов
    const existingTasks = await db
      .select({
        orderId: productionTasks.orderId,
        productId: productionTasks.productId,
        requestedQuantity: productionTasks.requestedQuantity,
        status: productionTasks.status
      })
      .from(productionTasks)
      .where(sql`${productionTasks.status} IN ('pending', 'in_progress')`);

    // Группируем существующие задания по заказам для быстрого поиска
    const tasksByOrder = existingTasks.reduce((acc, task) => {
      const key = `${task.orderId}-${task.productId}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(task);
      return acc;
    }, {} as Record<string, typeof existingTasks>);

    for (const order of activeOrders) {
      try {
        // Анализируем доступность товаров заказа
        const { analyzeOrderAvailability } = await import('./orderStatusCalculator');
        const analysis = await analyzeOrderAvailability(order.orderId);

        if (analysis.should_suggest_production) {
          // Рассчитываем приоритет с учетом срочности и сроков поставки
          let taskPriority = order.priority === 'urgent' ? 5 : 
                            order.priority === 'high' ? 4 : 
                            order.priority === 'normal' ? 3 : 2;

          // Повышаем приоритет для заказов с близким сроком поставки
          if (order.deliveryDate) {
            const daysUntilDelivery = Math.ceil(
              (new Date(order.deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysUntilDelivery <= 3 && taskPriority < 5) {
              taskPriority = Math.min(5, taskPriority + 1);
            } else if (daysUntilDelivery <= 7 && taskPriority < 4) {
              taskPriority = Math.min(4, taskPriority + 1);
            }
          }

          // Создаем задания для товаров с дефицитом
          const itemsNeedingProduction = analysis.items.filter(item => item.shortage > 0);

          for (const item of itemsNeedingProduction) {
            const taskKey = `${order.orderId}-${item.product_id}`;
            const existingTasksForProduct = tasksByOrder[taskKey] || [];

            // Рассчитываем уже запланированное количество для этого товара
            const alreadyPlanned = existingTasksForProduct.reduce((sum, task) => {
              return sum + task.requestedQuantity;
            }, 0);

            // Определяем нужное количество с учетом уже запланированного
            const neededQuantity = Math.max(0, item.shortage - alreadyPlanned);

            if (neededQuantity > 0) {
              // Создаем новое задание
              await db.insert(productionTasks).values({
                orderId: order.orderId,
                productId: item.product_id,
                requestedQuantity: neededQuantity,
                status: 'pending',
                priority: taskPriority,
                notes: `Автоматически создано для заказа ${order.orderNumber}. Дефицит: ${neededQuantity} шт.`,
                createdBy: 1 // системный пользователь
              });

              result.migrated++;
            } else {
              // Дефицит уже покрыт существующими заданиями
              result.existing++;
            }
          }
        }

      } catch (error) {
        result.errors.push(`Ошибка создания заданий для заказа ${order.orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    result.errors.push(`Общая ошибка создания заданий: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Полная синхронизация производственных систем
 */
export async function fullProductionSync(): Promise<{
  queueSync: SyncResult;
  ordersSync: SyncResult;
  summary: {
    totalMigrated: number;
    totalExisting: number;
    totalErrors: number;
  };
}> {
  const queueSync = await syncProductionQueueToTasks();
  const ordersSync = await createTasksForPendingOrders();

  return {
    queueSync,
    ordersSync,
    summary: {
      totalMigrated: queueSync.migrated + ordersSync.migrated,
      totalExisting: queueSync.existing + ordersSync.existing,
      totalErrors: queueSync.errors.length + ordersSync.errors.length
    }
  };
}

/**
 * Автоматически пересчитывает производственные потребности
 * Обновляет существующие задания при изменении ситуации
 */
export async function recalculateProductionNeeds(): Promise<{
  created: number;
  updated: number;
  cancelled: number;
  errors: string[];
}> {
  const result: {
    created: number;
    updated: number;
    cancelled: number;
    errors: string[];
  } = {
    created: 0,
    updated: 0,
    cancelled: 0,
    errors: []
  };

  try {
    // Получаем все активные заказы и анализируем их потребности
    const activeOrders = await db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        priority: orders.priority,
        deliveryDate: orders.deliveryDate,
        status: orders.status
      })
      .from(orders)
      .where(sql`${orders.status} IN ('new', 'confirmed', 'in_production')`);

    // Получаем все активные задания
    const activeTasks = await db
      .select({
        id: productionTasks.id,
        orderId: productionTasks.orderId,
        productId: productionTasks.productId,
        requestedQuantity: productionTasks.requestedQuantity,
        status: productionTasks.status
      })
      .from(productionTasks)
      .where(sql`${productionTasks.status} IN ('pending', 'in_progress', 'paused')`);

    // Группируем задания по заказам для анализа
    const tasksByOrder = activeTasks.reduce((acc, task) => {
      // Пропускаем задания без привязки к заказу
      if (task.orderId === null) {
        return acc;
      }
      
      if (!acc[task.orderId]) {
        acc[task.orderId] = [];
      }
      acc[task.orderId].push(task);
      return acc;
    }, {} as Record<number, typeof activeTasks>);

    for (const order of activeOrders) {
      try {
        // Анализируем текущие потребности заказа
        const { analyzeOrderAvailability } = await import('./orderStatusCalculator');
        const analysis = await analyzeOrderAvailability(order.orderId);

        const currentTasks = tasksByOrder[order.orderId] || [];
        
        if (analysis.should_suggest_production) {
          // Обрабатываем каждый товар с дефицитом
          for (const item of analysis.items.filter(i => i.shortage > 0)) {
            const existingTasksForProduct = currentTasks.filter(t => t.productId === item.product_id);
            
            // Рассчитываем уже запланированное количество
            const plannedQuantity = existingTasksForProduct.reduce((sum, task) => {
              return sum + task.requestedQuantity;
            }, 0);

            const neededQuantity = item.shortage;
            
            if (plannedQuantity < neededQuantity) {
              // Нужно создать дополнительное задание
              const additionalQuantity = neededQuantity - plannedQuantity;
              
              const taskPriority = order.priority === 'urgent' ? 5 : 
                                  order.priority === 'high' ? 4 : 
                                  order.priority === 'normal' ? 3 : 2;

              await db.insert(productionTasks).values({
                orderId: order.orderId,
                productId: item.product_id,
                requestedQuantity: additionalQuantity,
                status: 'pending',
                priority: taskPriority,
                notes: `Автоматически создано при пересчете. Дополнительная потребность: ${additionalQuantity} шт.`,
                createdBy: 1
              });

              result.created++;
              
            } else if (plannedQuantity > neededQuantity) {
              // Запланировано больше чем нужно - уменьшаем или отменяем задания
              let excessQuantity = plannedQuantity - neededQuantity;
              
              // Сначала отменяем предложенные задания
              const suggestedTasks = existingTasksForProduct
                .filter(t => t.status === 'pending') // Changed from 'suggested' to 'pending'
                .sort((a, b) => b.requestedQuantity - a.requestedQuantity); // Сначала большие

              for (const task of suggestedTasks) {
                if (excessQuantity <= 0) break;
                
                const taskQuantity = task.requestedQuantity;
                
                if (taskQuantity <= excessQuantity) {
                  // Отменяем задание полностью
                  await db.update(productionTasks)
                    .set({
                      status: 'cancelled' as const
                    })
                    .where(eq(productionTasks.id, task.id));
                    
                  excessQuantity -= taskQuantity;
                  result.cancelled++;
                } else {
                  // Уменьшаем количество
                  await db.update(productionTasks)
                    .set({
                      requestedQuantity: taskQuantity - excessQuantity,
                      notes: `Количество уменьшено при пересчете на ${excessQuantity} шт.`,
                      updatedAt: new Date()
                    })
                    .where(eq(productionTasks.id, task.id));
                    
                  excessQuantity = 0;
                  result.updated++;
                }
              }
            }
          }
        } else {
          // Заказ больше не требует производства - отменяем предложенные задания
          const suggestedTasksToCancel = currentTasks.filter(t => t.status === 'pending'); // Changed from 'suggested' to 'pending'
          
          for (const task of suggestedTasksToCancel) {
            await db.update(productionTasks)
              .set({
                status: 'cancelled',
                updatedAt: new Date()
              })
              .where(eq(productionTasks.id, task.id));
              
            result.cancelled++;
          }
        }

      } catch (error) {
        result.errors.push(`Ошибка пересчета для заказа ${order.orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    result.errors.push(`Общая ошибка пересчета: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Отправляет уведомления о готовых к отгрузке заказах
 */
export async function notifyReadyOrders(): Promise<{
  notified: number;
  errors: string[];
}> {
  const result: {
    notified: number;
    errors: string[];
  } = {
    notified: 0,
    errors: []
  };

  try {
    // Находим заказы готовые к отгрузке без недавних уведомлений
    const readyOrders = await db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        managerId: orders.managerId,
        status: orders.status
      })
      .from(orders)
      .where(sql`${orders.status} IN ('confirmed', 'ready')`);

    for (const order of readyOrders) {
      try {
        // Проверяем, не отправляли ли уже уведомление недавно
        const recentNotification = await db
          .select({ id: orderMessages.id })
          .from(orderMessages)
          .where(
            and(
              eq(orderMessages.orderId, order.orderId),
              sql`${orderMessages.message} LIKE '%готов к отгрузке%'`,
              sql`${orderMessages.createdAt} > NOW() - INTERVAL '24 hours'`
            )
          )
          .limit(1);

        if (recentNotification.length === 0) {
          // Отправляем уведомление в чат заказа
          await db.insert(orderMessages).values({
            orderId: order.orderId,
            userId: 1, // системный пользователь
            message: `🚀 УВЕДОМЛЕНИЕ: Заказ "${order.orderNumber}" для клиента "${order.customerName}" готов к отгрузке!`
          });

          result.notified++;
        }

      } catch (error) {
        result.errors.push(`Ошибка уведомления для заказа ${order.orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    result.errors.push(`Общая ошибка уведомлений: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Получает статистику синхронизации
 */
export async function getSyncStatistics() {
  try {
    const [queueCount, tasksCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(productionQueue),
      db.select({ count: sql<number>`count(*)` }).from(productionTasks)
    ]);

    const queueByStatus = await db
      .select({
        status: productionQueue.status,
        count: sql<number>`count(*)`
      })
      .from(productionQueue)
      .groupBy(productionQueue.status);

    const tasksByStatus = await db
      .select({
        status: productionTasks.status,
        count: sql<number>`count(*)`
      })
      .from(productionTasks)
      .groupBy(productionTasks.status);

    return {
      production_queue: {
        total: Number(queueCount[0]?.count || 0),
        by_status: queueByStatus.reduce((acc, item) => {
          if (item.status) {
            acc[item.status] = Number(item.count);
          }
          return acc;
        }, {} as Record<string, number>)
      },
      production_tasks: {
        total: Number(tasksCount[0]?.count || 0),
        by_status: tasksByStatus.reduce((acc, item) => {
          if (item.status) {
            acc[item.status] = Number(item.count);
          }
          return acc;
        }, {} as Record<string, number>)
      }
    };

  } catch (error) {
    throw new Error(`Ошибка получения статистики: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 