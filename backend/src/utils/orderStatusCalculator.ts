import { db } from '../db/index.js';
import { stock, productionTasks, productionQueue, orderItems, orders } from '../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';

// Используем существующие статусы из базы данных
export type OrderStatus = 'new' | 'confirmed' | 'in_production' | 'ready' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItemAvailability {
  product_id: number;
  required_quantity: number;
  available_quantity: number;
  in_production_quantity: number;
  shortage: number;
  status: 'available' | 'partially_available' | 'needs_production';
}

export interface OrderAvailabilityAnalysis {
  order_id: number;
  status: OrderStatus;
  items: OrderItemAvailability[];
  total_items: number;
  available_items: number;
  partially_available_items: number;
  needs_production_items: number;
  can_be_fulfilled: boolean;
  should_suggest_production: boolean;
}

/**
 * Анализирует доступность товаров для заказа
 */
export async function analyzeOrderAvailability(orderId: number): Promise<OrderAvailabilityAnalysis> {
  // Получаем все товары заказа
  const orderItemsData = await db
    .select({
      product_id: orderItems.productId,
      quantity: orderItems.quantity
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (orderItemsData.length === 0) {
    throw new Error('Заказ не содержит товаров');
  }

  const productIds = orderItemsData.map(item => item.product_id);

  // Получаем текущие остатки
  const stockData = await db
    .select({
      product_id: stock.productId,
      quantity: stock.currentStock
    })
    .from(stock)
    .where(inArray(stock.productId, productIds));

  // Получаем количество в производстве (только из новой системы производственных заданий)
  const productionTasksData = await db
    .select({
      product_id: productionTasks.productId,
      total_in_production: sql<number>`
        COALESCE(SUM(
          CASE 
            WHEN ${productionTasks.status} IN ('approved', 'in_progress') 
            THEN COALESCE(${productionTasks.approvedQuantity}, ${productionTasks.requestedQuantity})
            ELSE 0
          END
        ), 0)
      `.as('total_in_production')
    })
    .from(productionTasks)
    .where(
      and(
        inArray(productionTasks.productId, productIds),
        inArray(productionTasks.status, ['approved', 'in_progress'])
      )
    )
    .groupBy(productionTasks.productId);

  // Создаем карты для быстрого доступа
  const stockMap = new Map(stockData.map(s => [s.product_id, s.quantity]));
  const productionTasksMap = new Map(productionTasksData.map(p => [p.product_id, p.total_in_production]));

  // Анализируем каждый товар
  const itemsAnalysis: OrderItemAvailability[] = orderItemsData.map(orderItem => {
    const availableStock = stockMap.get(orderItem.product_id) || 0;
    const totalInProduction = productionTasksMap.get(orderItem.product_id) || 0;
    
    const shortage = Math.max(0, orderItem.quantity - availableStock);
    
    let itemStatus: 'available' | 'partially_available' | 'needs_production';
    
    if (availableStock >= orderItem.quantity) {
      itemStatus = 'available';
    } else if (availableStock > 0) {
      itemStatus = 'partially_available';
    } else {
      itemStatus = 'needs_production';
    }

    return {
      product_id: orderItem.product_id,
      required_quantity: orderItem.quantity,
      available_quantity: availableStock,
      in_production_quantity: totalInProduction,
      shortage,
      status: itemStatus
    };
  });

  // Определяем общий статус заказа на основе анализа доступности
  const availableItems = itemsAnalysis.filter(item => item.status === 'available').length;
  const partiallyAvailableItems = itemsAnalysis.filter(item => item.status === 'partially_available').length;
  const needsProductionItems = itemsAnalysis.filter(item => item.status === 'needs_production').length;

  let orderStatus: OrderStatus;
  const hasProduction = itemsAnalysis.some(item => item.in_production_quantity > 0);
  const allItemsAvailable = availableItems === itemsAnalysis.length;
  const hasUnavailableItems = needsProductionItems > 0 || partiallyAvailableItems > 0;

  // Логика определения статуса заказа:
  // 1. Если все товары доступны - статус может быть 'confirmed' или 'ready'
  // 2. Если есть товары в производстве - статус 'in_production'
  // 3. Если товары недоступны и нет производства - остается 'new'
  
  if (allItemsAvailable) {
    // Все товары доступны - заказ может быть подтвержден или готов
    orderStatus = 'confirmed'; // или 'ready' в зависимости от бизнес-логики
  } else if (hasProduction) {
    // Есть товары в производстве
    orderStatus = 'in_production';
  } else {
    // Товары недоступны, производство не запущено
    orderStatus = 'new'; // остается в статусе создания
  }

  const canBeFulfilled = itemsAnalysis.every(item => 
    (item.available_quantity + item.in_production_quantity) >= item.required_quantity
  );

  const shouldSuggestProduction = hasUnavailableItems && !hasProduction;

  return {
    order_id: orderId,
    status: orderStatus,
    items: itemsAnalysis,
    total_items: itemsAnalysis.length,
    available_items: availableItems,
    partially_available_items: partiallyAvailableItems,
    needs_production_items: needsProductionItems,
    can_be_fulfilled: canBeFulfilled,
    should_suggest_production: shouldSuggestProduction
  };
}

/**
 * Обновляет статус заказа на основе анализа доступности
 */
export async function updateOrderStatus(orderId: number): Promise<OrderStatus> {
  const analysis = await analyzeOrderAvailability(orderId);
  
  // Обновляем статус в базе данных используя правильный синтаксис Drizzle ORM
  await db
    .update(orders)
    .set({ status: analysis.status })
    .where(eq(orders.id, orderId));

  return analysis.status;
}

/**
 * Пересчитывает статусы всех заказов
 */
export async function recalculateAllOrderStatuses(): Promise<void> {
  // Получаем все активные заказы (исключаем завершенные и отмененные)
  const ordersData = await db
    .select({ id: orders.id })
    .from(orders)
    .where(sql`${orders.status} NOT IN ('delivered', 'cancelled')`);

  for (const order of ordersData) {
    try {
      await updateOrderStatus(order.id);
    } catch (error) {
      console.error(`Ошибка пересчета статуса заказа ${order.id}:`, error);
    }
  }
} 