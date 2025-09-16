import { db, schema } from '../db';
import { eq, and, sql, inArray, desc, asc } from 'drizzle-orm';
import { updateOrderStatus } from './orderStatusCalculator';

/**
 * Распределяет новый товар между заказами по дате поставки и приоритету
 */
export async function distributeNewStockToOrders(productId: number, newStock: number): Promise<{
  distributed: number;
  remaining: number;
  ordersUpdated: number[];
}> {
  try {
    console.log(`🔄 Начинаем распределение ${newStock} шт товара ${productId}`);

    // Получаем все заказы, ожидающие этот товар
    const waitingOrders = await db.query.orderItems.findMany({
      where: and(
        eq(schema.orderItems.productId, productId),
        sql`${schema.orderItems.quantity} > ${schema.orderItems.reservedQuantity}` // Есть недобор
      ),
      with: {
        order: {
          columns: {
            id: true,
            orderNumber: true,
            deliveryDate: true,
            priority: true,
            createdAt: true
          }
        }
      }
    });

    if (waitingOrders.length === 0) {
      console.log(`ℹ️ Нет заказов, ожидающих товар ${productId}`);
      return { distributed: 0, remaining: newStock, ordersUpdated: [] };
    }

    // Сортируем по дате поставки (ближайшие первыми), затем по приоритету, затем по дате создания
    const sortedOrders = waitingOrders.sort((a, b) => {
      const aDelivery = a.order.deliveryDate;
      const bDelivery = b.order.deliveryDate;
      
      // Если у обоих есть дата поставки - сортируем по ней
      if (aDelivery && bDelivery) {
        const dateDiff = new Date(aDelivery).getTime() - new Date(bDelivery).getTime();
        if (dateDiff !== 0) return dateDiff;
      }
      
      // Если у одного есть дата, а у другого нет - приоритет тому, у кого есть
      if (aDelivery && !bDelivery) return -1;
      if (!aDelivery && bDelivery) return 1;
      
      // Если у обоих нет даты или даты одинаковые - сортируем по приоритету
      const priorityOrder = { urgent: 5, high: 4, normal: 3, low: 2 };
      const aPriority = priorityOrder[a.order.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.order.priority as keyof typeof priorityOrder] || 0;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // В последнюю очередь - по дате создания (раньше созданные первыми)
      return new Date(a.order.createdAt || 0).getTime() - new Date(b.order.createdAt || 0).getTime();
    });

    let remainingStock = newStock;
    let totalDistributed = 0;
    const ordersUpdated: number[] = [];

    console.log(`📋 Найдено ${sortedOrders.length} заказов, ожидающих товар ${productId}`);

    for (const orderItem of sortedOrders) {
      if (remainingStock <= 0) break;
      
      const shortage = orderItem.quantity - (orderItem.reservedQuantity || 0);
      const canReserve = Math.min(shortage, remainingStock);
      
      if (canReserve > 0) {
        // Увеличиваем резерв для этого заказа
        await db.update(schema.orderItems)
          .set({ 
            reservedQuantity: (orderItem.reservedQuantity || 0) + canReserve
          })
          .where(eq(schema.orderItems.id, orderItem.id));
        
        // ВАЖНО: Увеличиваем общий резерв склада
        await db.update(schema.stock)
          .set({
            reservedStock: sql`${schema.stock.reservedStock} + ${canReserve}`,
            updatedAt: new Date()
          })
          .where(eq(schema.stock.productId, productId));
        
        remainingStock -= canReserve;
        totalDistributed += canReserve;
        ordersUpdated.push(orderItem.orderId);
        
        console.log(`✅ Заказ ${orderItem.order.orderNumber}: добавлено ${canReserve} шт (осталось ${remainingStock})`);
        
        // Пересчитываем статус заказа
        try {
          await updateOrderStatus(orderItem.orderId);
        } catch (error) {
          console.error(`❌ Ошибка пересчета статуса заказа ${orderItem.orderId}:`, error);
        }
      }
    }

    console.log(`🎯 Распределение завершено: ${totalDistributed} шт распределено, ${remainingStock} шт осталось`);

    return {
      distributed: totalDistributed,
      remaining: remainingStock,
      ordersUpdated
    };
  } catch (error) {
    console.error(`❌ Ошибка распределения товара ${productId}:`, error);
    return { distributed: 0, remaining: newStock, ordersUpdated: [] };
  }
}

/**
 * Пересчитывает статусы всех заказов для конкретного товара
 */
export async function recalculateOrdersForProduct(productId: number): Promise<void> {
  try {
    // Получаем все активные заказы, содержащие этот товар
    const ordersWithProduct = await db
      .select({ orderId: schema.orderItems.orderId })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orderItems.productId, productId),
          inArray(schema.orders.status, ['new', 'confirmed', 'in_production', 'ready'])
        )
      )
      .groupBy(schema.orderItems.orderId);

    console.log(`🔄 Пересчитываем статусы ${ordersWithProduct.length} заказов для товара ${productId}`);

    for (const { orderId } of ordersWithProduct) {
      try {
        await updateOrderStatus(orderId);
      } catch (error) {
        console.error(`❌ Ошибка пересчета статуса заказа ${orderId}:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Ошибка пересчета заказов для товара ${productId}:`, error);
  }
}
