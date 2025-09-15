import { db } from '../db/index';
import { stock, productionTasks, productionQueue, orderItems, orders } from '../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

// Используем существующие статусы из базы данных
export type OrderStatus = 'new' | 'confirmed' | 'in_production' | 'ready' | 'completed' | 'cancelled';

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
      quantity: orderItems.quantity,
      reserved_quantity: orderItems.reservedQuantity
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (orderItemsData.length === 0) {
    throw new Error('Заказ не содержит товаров');
  }

  // Получаем текущий статус заказа для правильного определения нового статуса
  const currentOrder = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { status: true }
  });

  const currentStatus = currentOrder?.status || 'new';

  const productIds = orderItemsData.map(item => item.product_id);

  // Получаем текущие остатки
  const stockData = await db
    .select({
      product_id: stock.productId,
      current_stock: stock.currentStock
    })
    .from(stock)
    .where(inArray(stock.productId, productIds));

  // Получаем реальные резервы из активных заказов (исключая текущий заказ)
  const reservedData = await db
    .select({
      product_id: orderItems.productId,
      total_reserved: sql<number>`COALESCE(SUM(${orderItems.reservedQuantity}), 0)`.as('total_reserved')
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        inArray(orderItems.productId, productIds),
        inArray(orders.status, ['new', 'confirmed', 'in_production']),
        sql`${orders.id} != ${orderId}` // Исключаем текущий заказ
      )
    )
    .groupBy(orderItems.productId);

  // Получаем количество в производстве (только из новой системы производственных заданий)
  const productionTasksData = await db
    .select({
      product_id: productionTasks.productId,
      total_in_production: sql<number>`
        COALESCE(SUM(
          CASE 
            WHEN ${productionTasks.status} IN ('pending', 'in_progress', 'paused') 
            THEN ${productionTasks.requestedQuantity}
            ELSE 0
          END
        ), 0)
      `.as('total_in_production')
    })
    .from(productionTasks)
    .where(
      and(
        inArray(productionTasks.productId, productIds),
        inArray(productionTasks.status, ['pending', 'in_progress', 'paused'])
      )
    )
    .groupBy(productionTasks.productId);

  // Создаем карты для быстрого доступа
  const stockMap = new Map(stockData.map(s => [s.product_id, { 
    currentStock: s.current_stock
  }]));
  const reservedMap = new Map(reservedData.map(r => [r.product_id, r.total_reserved]));
  const productionTasksMap = new Map(productionTasksData.map(p => [p.product_id, p.total_in_production]));

  // Анализируем каждый товар
  const itemsAnalysis: OrderItemAvailability[] = orderItemsData.map(orderItem => {
    const stockInfo = stockMap.get(orderItem.product_id);
    const currentStock = stockInfo?.currentStock || 0;
    const totalReserved = reservedMap.get(orderItem.product_id) || 0; // Реальные резервы из других заказов
    const reservedForThisOrder = orderItem.reserved_quantity || 0;
    const totalInProduction = productionTasksMap.get(orderItem.product_id) || 0;
    const needed = orderItem.quantity;
    
    // Валидация данных: резерв не может превышать потребность
    if (reservedForThisOrder > needed) {
      console.warn(`⚠️ Валидация: резерв (${reservedForThisOrder}) превышает потребность (${needed}) для товара ${orderItem.product_id} в заказе ${orderId}`);
    }
    
    // ИСПРАВЛЕННАЯ ЛОГИКА: учитываем свободный остаток при определении статуса
    const free_stock = currentStock - totalReserved; // Свободный (не зарезервированный) остаток
    
    let itemStatus: 'available' | 'partially_available' | 'needs_production';
    let shortage: number;
    let available_quantity: number;
    
    if (reservedForThisOrder >= needed) {
      // Полностью зарезервировано или избыточный резерв
      itemStatus = 'available';
      shortage = 0;
      available_quantity = needed;
    } else if (reservedForThisOrder + Math.max(0, free_stock) >= needed) {
      // Резерв + свободный остаток достаточны (включая случай "впритык")
      itemStatus = 'available';
      shortage = 0;
      available_quantity = needed;
    } else {
      // Недостаточно даже с учетом свободного остатка
      itemStatus = 'needs_production';
      shortage = needed - (reservedForThisOrder + Math.max(0, free_stock));
      available_quantity = reservedForThisOrder + Math.max(0, free_stock);
    }

    return {
      product_id: orderItem.product_id,
      required_quantity: needed,
      available_quantity,
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
  const allItemsFullyAvailable = availableItems === itemsAnalysis.length;
  const hasUnavailableItems = needsProductionItems > 0 || partiallyAvailableItems > 0;

  // КАРДИНАЛЬНО ИСПРАВЛЕННАЯ ЛОГИКА определения статуса заказа:
  // ПРИОРИТЕТ 1: Если ВСЕ товары доступны - заказ готов (независимо от производства)
  if (allItemsFullyAvailable) {
    // ВСЕ товары в ПОЛНОМ объеме доступны для отгрузки
    if (currentStatus === 'confirmed' || currentStatus === 'in_production') {
      // Заказ уже был подтвержден - теперь готов к отгрузке
      orderStatus = 'ready';
    } else if (currentStatus === 'ready') {
      // Заказ уже готов - оставляем как есть
      orderStatus = 'ready';
    } else {
      // Новый заказ с доступными товарами - подтверждаем
      orderStatus = 'confirmed';
    }
  } 
  // ПРИОРИТЕТ 2: Если товары НЕДОступны И есть производство - в работе
  else if (hasUnavailableItems && hasProduction) {
    orderStatus = 'in_production';
  } 
  // ПРИОРИТЕТ 3: Если товары НЕДОступны И НЕТ производства - нужно запустить
  else if (hasUnavailableItems && !hasProduction) {
    if (currentStatus === 'confirmed') {
      // Подтвержденный заказ, но товары недоступны - отправляем в производство
      orderStatus = 'in_production';
    } else {
      // Новый заказ с недоступными товарами
      orderStatus = 'new';
    }
  } 
  // ПРИОРИТЕТ 4: Остальные случаи - сохраняем текущий статус
  else {
    orderStatus = currentStatus;
  }

  // Дополнительная проверка стабильности: если статус не должен меняться, оставляем текущий
  if (orderStatus !== currentStatus) {
    // Логируем только реальные изменения
    console.log(`📊 Статус заказа ${orderId} изменен: ${getStatusLabel(currentStatus)} → ${getStatusLabel(orderStatus)}`);
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
  // Получаем текущий статус для сравнения
  const currentOrder = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { status: true, orderNumber: true }
  });
  
  const currentStatus = currentOrder?.status || 'new';
  const orderNumber = currentOrder?.orderNumber || `#${orderId}`;
  
  const analysis = await analyzeOrderAvailability(orderId);
  
  // Логируем изменение статуса только если оно действительно произошло
  if (currentStatus !== analysis.status) {
    console.log(`📊 Статус заказа ${orderNumber} изменен: ${getStatusLabel(currentStatus)} → ${getStatusLabel(analysis.status)}`);
    console.log(`   📦 Товары: ${analysis.available_items} доступны, ${analysis.needs_production_items} требуют производства`);
    
    // Детальное логирование по товарам
    analysis.items.forEach(item => {
      const statusText = item.status === 'available' ? 'доступен' : 
                       item.status === 'needs_production' ? 'требует производства' : 'частично доступен';
      console.log(`   🎯 Товар ${item.product_id}: ${item.required_quantity} нужно, ${item.available_quantity} доступно, ${item.shortage} дефицит - ${statusText}`);
    });
  }
  
  // Обновляем статус в базе данных используя правильный синтаксис Drizzle ORM
  await db
    .update(orders)
    .set({ status: analysis.status })
    .where(eq(orders.id, orderId));

  return analysis.status;
}

/**
 * Получить русское название статуса для логирования
 */
function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    'new': 'Новый',
    'confirmed': 'Подтвержден',
    'in_production': 'В производстве',
    'ready': 'Готов к отгрузке',
    'completed': 'Выполнен',
    'cancelled': 'Отменен'
  };
  return labels[status] || status;
}

/**
 * Отменяет ненужные производственные задания для заказа
 * Если все товары заказа доступны, связанные задания отменяются
 */
export async function cancelUnnecessaryProductionTasks(orderId: number): Promise<{
  cancelled: number;
  tasks: any[];
}> {
  try {
    const analysis = await analyzeOrderAvailability(orderId);
    
    // Если все товары доступны, отменяем связанные производственные задания
    if (analysis.status === 'ready' || analysis.status === 'confirmed') {
      const unnecessaryTasks = await db
        .select({
          id: productionTasks.id,
          productId: productionTasks.productId,
          requestedQuantity: productionTasks.requestedQuantity,
          status: productionTasks.status
        })
        .from(productionTasks)
        .where(
          and(
            eq(productionTasks.orderId, orderId),
            inArray(productionTasks.status, ['pending', 'in_progress', 'paused'])
          )
        );

      if (unnecessaryTasks.length > 0) {
        // Отменяем ненужные задания
        await db
          .update(productionTasks)
          .set({
            status: 'cancelled',
            notes: sql`COALESCE(${productionTasks.notes}, '') || ' | Автоматически отменено: товары уже доступны'`,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(productionTasks.orderId, orderId),
              inArray(productionTasks.status, ['pending', 'in_progress', 'paused'])
            )
          );

        console.log(`🚫 Отменено ${unnecessaryTasks.length} ненужных производственных заданий для заказа ${orderId}`);
        
        return {
          cancelled: unnecessaryTasks.length,
          tasks: unnecessaryTasks
        };
      }
    }

    return { cancelled: 0, tasks: [] };
  } catch (error) {
    console.error(`Ошибка отмены производственных заданий для заказа ${orderId}:`, error);
    return { cancelled: 0, tasks: [] };
  }
}

/**
 * Пересчитывает статусы всех заказов и очищает ненужные производственные задания
 */
export async function recalculateAllOrderStatuses(): Promise<void> {
  // Получаем все активные заказы (исключаем завершенные и отмененные)
  const ordersData = await db
    .select({ id: orders.id })
    .from(orders)
    .where(sql`${orders.status} NOT IN ('completed', 'cancelled')`);

  for (const order of ordersData) {
    try {
      await updateOrderStatus(order.id);
      
      // Отменяем ненужные производственные задания
      await cancelUnnecessaryProductionTasks(order.id);
    } catch (error) {
      console.error(`Ошибка пересчета статуса заказа ${order.id}:`, error);
    }
  }
} 