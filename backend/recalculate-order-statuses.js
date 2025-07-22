const { Pool } = require('pg');

// Конфигурация подключения к Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:xeIitZntkaAAeoZSFpsOsfCOKpoORwGA@yamanote.proxy.rlwy.net:41401/railway',
  ssl: { rejectUnauthorized: false }
});

/**
 * Пересчитывает статус одного заказа
 */
async function recalculateOrderStatus(client, orderId) {
  try {
    // Получаем текущий статус заказа
    const orderResult = await client.query(
      'SELECT id, status FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      console.log(`⚠️ Заказ ${orderId} не найден`);
      return null;
    }

    const currentStatus = orderResult.rows[0].status;

    // Получаем все товары заказа
    const itemsResult = await client.query(`
      SELECT 
        oi.product_id,
        oi.quantity,
        COALESCE(oi.reserved_quantity, 0) as reserved_quantity
      FROM order_items oi
      WHERE oi.order_id = $1
    `, [orderId]);

    if (itemsResult.rows.length === 0) {
      console.log(`⚠️ Заказ ${orderId} не содержит товаров`);
      return currentStatus;
    }

    const orderItems = itemsResult.rows;
    const productIds = orderItems.map(item => item.product_id);

    // Получаем остатки товаров
    const stockResult = await client.query(`
      SELECT 
        product_id,
        current_stock,
        reserved_stock
      FROM stock
      WHERE product_id = ANY($1::int[])
    `, [productIds]);

    const stockMap = new Map();
    stockResult.rows.forEach(stock => {
      stockMap.set(stock.product_id, {
        currentStock: stock.current_stock,
        reservedStock: stock.reserved_stock
      });
    });

    // Получаем количество в производстве
    const productionResult = await client.query(`
      SELECT 
        product_id,
        COALESCE(SUM(
          CASE 
            WHEN status IN ('pending', 'in_progress', 'paused') 
            THEN requested_quantity
            ELSE 0
          END
        ), 0) as total_in_production
      FROM production_tasks
      WHERE product_id = ANY($1::int[])
        AND status IN ('pending', 'in_progress', 'paused')
      GROUP BY product_id
    `, [productIds]);

    const productionMap = new Map();
    productionResult.rows.forEach(prod => {
      productionMap.set(prod.product_id, prod.total_in_production);
    });

    // Анализируем каждый товар
    let availableItems = 0;
    let partiallyAvailableItems = 0;
    let needsProductionItems = 0;
    let hasProduction = false;

    for (const item of orderItems) {
      const stockInfo = stockMap.get(item.product_id) || { currentStock: 0, reservedStock: 0 };
      const reservedForThisOrder = item.reserved_quantity;
      const totalInProduction = productionMap.get(item.product_id) || 0;

      // Доступно для этого заказа = общий остаток - (общий резерв - резерв для этого заказа)
      const availableForThisOrder = stockInfo.currentStock - (stockInfo.reservedStock - reservedForThisOrder);

      if (totalInProduction > 0) {
        hasProduction = true;
      }

      if (availableForThisOrder >= item.quantity) {
        availableItems++;
      } else if (availableForThisOrder > 0) {
        partiallyAvailableItems++;
      } else {
        needsProductionItems++;
      }
    }

    // Определяем новый статус
    const allItemsFullyAvailable = availableItems === orderItems.length;
    const hasUnavailableItems = needsProductionItems > 0 || partiallyAvailableItems > 0;

    let newStatus = currentStatus;

    if (allItemsFullyAvailable) {
      // ВСЕ товары в ПОЛНОМ объеме доступны для отгрузки
      if (currentStatus === 'confirmed' || currentStatus === 'in_production') {
        // Заказ уже был подтвержден - теперь готов к отгрузке
        newStatus = 'ready';
      } else if (currentStatus === 'new') {
        // Новый заказ с доступными товарами - подтверждаем
        newStatus = 'confirmed';
      }
    } else if (hasProduction) {
      // Есть товары в производстве - заказ в работе
      newStatus = 'in_production';
    } else if (hasUnavailableItems) {
      // Товары недоступны, производство не запущено
      if (currentStatus === 'confirmed') {
        // Подтвержденный заказ, но товары недоступны - отправляем в производство
        newStatus = 'in_production';
      } else if (currentStatus === 'new') {
        // Новый заказ с недоступными товарами
        newStatus = 'new';
      }
    }

    // Обновляем статус если он изменился
    if (newStatus !== currentStatus) {
      await client.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        [newStatus, orderId]
      );
      console.log(`✅ Заказ ${orderId}: ${currentStatus} → ${newStatus}`);
      return newStatus;
    } else {
      console.log(`➡️ Заказ ${orderId}: статус остался ${currentStatus}`);
      return currentStatus;
    }

  } catch (error) {
    console.error(`❌ Ошибка пересчета заказа ${orderId}:`, error.message);
    return null;
  }
}

/**
 * Основная функция пересчета всех заказов
 */
async function recalculateAllOrderStatuses() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Начинаем пересчет статусов заказов...\n');

    // Получаем все активные заказы
    const ordersResult = await client.query(`
      SELECT id, order_number, status 
      FROM orders 
      WHERE status NOT IN ('completed', 'cancelled')
      ORDER BY id
    `);

    const orders = ordersResult.rows;
    console.log(`📋 Найдено ${orders.length} активных заказов для пересчета\n`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      const oldStatus = order.status;
      const newStatus = await recalculateOrderStatus(client, order.id);
      
      if (newStatus === null) {
        errorCount++;
      } else if (newStatus !== oldStatus) {
        updatedCount++;
      }
    }

    console.log(`\n📊 РЕЗУЛЬТАТЫ ПЕРЕСЧЕТА:`);
    console.log(`   ✅ Обработано заказов: ${orders.length}`);
    console.log(`   🔄 Обновлено статусов: ${updatedCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`\n🎉 Пересчет статусов завершен!`);

  } catch (error) {
    console.error('❌ Критическая ошибка при пересчете статусов:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем пересчет
if (require.main === module) {
  recalculateAllOrderStatuses().catch(console.error);
}

module.exports = { recalculateAllOrderStatuses }; 