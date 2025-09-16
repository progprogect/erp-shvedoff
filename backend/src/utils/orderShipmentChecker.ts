import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Проверяет, полностью ли отгружен заказ
 * @param orderId - ID заказа для проверки
 * @returns Promise<boolean> - true если заказ полностью отгружен
 */
export async function isOrderFullyShipped(orderId: number): Promise<boolean> {
  try {
    // Получаем заказ с его товарами
    const order = await db.query.orders.findFirst({
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
      return true; // Заказ уже завершен или не найден
    }

    // Получаем все завершенные отгрузки для этого заказа через shipment_orders
    const completedShipments = await db.query.shipments.findMany({
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
    for (const orderItem of order.items || []) {
      const requiredQty = orderItem.quantity;
      const shippedQty = shippedQuantities[orderItem.productId] || 0;
      
      if (shippedQty < requiredQty) {
        return false; // Не все товары отгружены
      }
    }

    return true; // Все товары отгружены
  } catch (error) {
    console.error('Ошибка при проверке статуса отгрузки заказа:', error);
    return false;
  }
}

/**
 * Обновляет статус заказа на "Отгружен" если он полностью отгружен
 * @param orderId - ID заказа для проверки и обновления
 * @param userId - ID пользователя для логирования
 * @returns Promise<boolean> - true если статус был обновлен
 */
export async function updateOrderStatusIfFullyShipped(orderId: number, userId: number): Promise<boolean> {
  try {
    // Проверяем, полностью ли отгружен заказ
    const isFullyShipped = await isOrderFullyShipped(orderId);
    
    if (!isFullyShipped) {
      return false; // Заказ не полностью отгружен
    }

    // Получаем текущий заказ
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId)
    });

    if (!order || order.status === 'completed') {
      return false; // Заказ не найден или уже завершен
    }

    // Обновляем статус на "Отгружен"
    await db.update(schema.orders)
      .set({
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(schema.orders.id, orderId));

    // Логируем изменение
    await db.insert(schema.auditLog).values({
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
    return true;
  } catch (error) {
    console.error('Ошибка при автоматическом обновлении статуса заказа:', error);
    return false;
  }
}

/**
 * Проверяет и обновляет статусы всех заказов, которые могут быть полностью отгружены
 * @param userId - ID пользователя для логирования
 * @returns Promise<number> - количество обновленных заказов
 */
export async function updateAllFullyShippedOrders(userId: number): Promise<number> {
  try {
    // Получаем все заказы со статусом 'ready'
    const readyOrders = await db.query.orders.findMany({
      where: eq(schema.orders.status, 'ready'),
      columns: { id: true, orderNumber: true }
    });

    let updatedCount = 0;
    
    for (const order of readyOrders) {
      const wasUpdated = await updateOrderStatusIfFullyShipped(order.id, userId);
      if (wasUpdated) {
        updatedCount++;
      }
    }

    console.log(`📦 Обновлено статусов заказов: ${updatedCount}`);
    return updatedCount;
  } catch (error) {
    console.error('Ошибка при массовом обновлении статусов заказов:', error);
    return 0;
  }
}

/**
 * Проверяет, привязан ли заказ к любой отгрузке (любого статуса)
 * @param orderId - ID заказа для проверки
 * @returns Promise<boolean> - true если заказ привязан к отгрузке
 */
export async function isOrderLinkedToShipment(orderId: number): Promise<boolean> {
  try {
    const shipmentOrder = await db.query.shipmentOrders.findFirst({
      where: eq(schema.shipmentOrders.orderId, orderId)
    });

    return !!shipmentOrder;
  } catch (error) {
    console.error('Ошибка при проверке связи заказ-отгрузка:', error);
    return false;
  }
}