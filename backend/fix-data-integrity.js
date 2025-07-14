const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const { 
  products, 
  stock, 
  orders, 
  orderItems, 
  productionQueue,
  auditLog 
} = require('./src/db/schema');
const { eq, sum, sql, and, inArray } = require('drizzle-orm');

// Инициализация базы данных
const sqlite = new Database('./database.db');
const db = drizzle(sqlite);

async function diagnoseAndFix() {
  console.log('🔍 ДИАГНОСТИКА ЦЕЛОСТНОСТИ ДАННЫХ ERP SHVEDOFF\n');
  
  try {
    // 1. Получаем все продукты с их данными
    const allProducts = await db.select().from(products);
    const allStock = await db.select().from(stock);
    const allOrders = await db.select().from(orders);
    const allOrderItems = await db.select().from(orderItems);
    const allProductionQueue = await db.select().from(productionQueue);
    
    console.log(`📊 Общая статистика:`);
    console.log(`   Товаров: ${allProducts.length}`);
    console.log(`   Складских записей: ${allStock.length}`);
    console.log(`   Заказов: ${allOrders.length}`);
    console.log(`   Позиций в заказах: ${allOrderItems.length}`);
    console.log(`   Задач в производстве: ${allProductionQueue.length}\n`);
    
    const problems = [];
    const fixes = [];
    
    // 2. Проверяем каждый товар
    for (const product of allProducts) {
      console.log(`🔍 Проверяем товар: ${product.name} (ID: ${product.id})`);
      
      // Получаем данные склада
      const stockData = allStock.find(s => s.productId === product.id);
      if (!stockData) {
        problems.push(`❌ Нет записи на складе для товара ${product.name}`);
        fixes.push({
          type: 'CREATE_STOCK',
          productId: product.id,
          quantity: 0,
          reserved: 0
        });
        continue;
      }
      
      // Считаем реальные резервы из активных заказов
      const activeOrderStatuses = ['new', 'confirmed', 'in_production'];
      const activeOrders = allOrders.filter(o => activeOrderStatuses.includes(o.status));
      const activeOrderIds = activeOrders.map(o => o.id);
      
      const productOrderItems = allOrderItems.filter(oi => 
        oi.productId === product.id && activeOrderIds.includes(oi.orderId)
      );
      
      const realReserved = productOrderItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Считаем реальное количество в производстве
      const productionItems = allProductionQueue.filter(pq => 
        pq.productId === product.id && pq.status === 'pending'
      );
      const realInProduction = productionItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Реальное доступное количество
      const realAvailable = Math.max(0, stockData.quantity - realReserved);
      
      console.log(`   📦 Склад: ${stockData.quantity} шт`);
      console.log(`   🔒 Резерв в базе: ${stockData.reserved} шт`);
      console.log(`   🔒 Реальный резерв (из заказов): ${realReserved} шт`);
      console.log(`   ✅ Доступно: ${realAvailable} шт`);
      console.log(`   🏭 В производстве: ${realInProduction} шт`);
      
      // Проверяем расхождения
      let hasProblems = false;
      
      if (stockData.reserved !== realReserved) {
        problems.push(`❌ ${product.name}: резерв в базе ${stockData.reserved}, реальный ${realReserved}`);
        fixes.push({
          type: 'UPDATE_STOCK_RESERVED',
          productId: product.id,
          oldReserved: stockData.reserved,
          newReserved: realReserved
        });
        hasProblems = true;
      }
      
      // Проверяем на отрицательные значения
      if (stockData.quantity < 0) {
        problems.push(`❌ ${product.name}: отрицательное количество на складе ${stockData.quantity}`);
        fixes.push({
          type: 'FIX_NEGATIVE_STOCK',
          productId: product.id,
          oldQuantity: stockData.quantity,
          newQuantity: 0
        });
        hasProblems = true;
      }
      
      if (realReserved > stockData.quantity) {
        problems.push(`❌ ${product.name}: резерв ${realReserved} больше чем на складе ${stockData.quantity}`);
        fixes.push({
          type: 'FIX_OVERRESERVATION',
          productId: product.id,
          stockQuantity: stockData.quantity,
          reservedQuantity: realReserved,
          newReserved: Math.min(realReserved, stockData.quantity)
        });
        hasProblems = true;
      }
      
      if (!hasProblems) {
        console.log(`   ✅ Данные корректны`);
      }
      
      console.log('');
    }
    
    // 3. Выводим сводку проблем
    console.log(`\n📋 НАЙДЕННЫЕ ПРОБЛЕМЫ (${problems.length}):`);
    problems.forEach((problem, i) => {
      console.log(`   ${i + 1}. ${problem}`);
    });
    
    if (fixes.length === 0) {
      console.log('\n✅ Проблем не найдено! Все данные корректны.');
      return;
    }
    
    // 4. Применяем исправления
    console.log(`\n🔧 ПРИМЕНЕНИЕ ИСПРАВЛЕНИЙ (${fixes.length}):`);
    
    for (const fix of fixes) {
      try {
        switch (fix.type) {
          case 'CREATE_STOCK':
            await db.insert(stock).values({
              productId: fix.productId,
              quantity: fix.quantity,
              reserved: fix.reserved,
              lastUpdated: new Date().toISOString()
            });
            console.log(`   ✅ Создана запись на складе для товара ID ${fix.productId}`);
            break;
            
          case 'UPDATE_STOCK_RESERVED':
            await db.update(stock)
              .set({ 
                reserved: fix.newReserved,
                lastUpdated: new Date().toISOString()
              })
              .where(eq(stock.productId, fix.productId));
            console.log(`   ✅ Обновлен резерв для товара ID ${fix.productId}: ${fix.oldReserved} → ${fix.newReserved}`);
            break;
            
          case 'FIX_NEGATIVE_STOCK':
            await db.update(stock)
              .set({ 
                quantity: fix.newQuantity,
                lastUpdated: new Date().toISOString()
              })
              .where(eq(stock.productId, fix.productId));
            console.log(`   ✅ Исправлено отрицательное количество для товара ID ${fix.productId}: ${fix.oldQuantity} → ${fix.newQuantity}`);
            break;
            
          case 'FIX_OVERRESERVATION':
            await db.update(stock)
              .set({ 
                reserved: fix.newReserved,
                lastUpdated: new Date().toISOString()
              })
              .where(eq(stock.productId, fix.productId));
            console.log(`   ✅ Исправлен чрезмерный резерв для товара ID ${fix.productId}: ${fix.reservedQuantity} → ${fix.newReserved}`);
            break;
        }
        
        // Логируем изменение в аудит
        await db.insert(auditLog).values({
          tableName: 'stock',
          operation: 'fix_data_integrity',
          recordId: fix.productId,
          changes: JSON.stringify(fix),
          userId: 1, // Системный пользователь
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.log(`   ❌ Ошибка при применении исправления ${fix.type}: ${error.message}`);
      }
    }
    
    console.log('\n🎯 ПЕРЕСЧЕТ ВСЕХ МЕТРИК:');
    
    // 5. Пересчитываем все метрики для всех товаров
    for (const product of allProducts) {
      const stockData = await db.select().from(stock).where(eq(stock.productId, product.id)).limit(1);
      
      if (stockData.length === 0) continue;
      
      // Реальные резервы из активных заказов
      const activeOrderStatuses = ['new', 'confirmed', 'in_production'];
      const realReserved = await db
        .select({
          total: sql`COALESCE(SUM(${orderItems.quantity}), 0)`
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(
          and(
            eq(orderItems.productId, product.id),
            inArray(orders.status, activeOrderStatuses)
          )
        );
      
      const reservedCount = parseInt(realReserved[0].total) || 0;
      
      // Обновляем корректный резерв
      await db.update(stock)
        .set({ 
          reserved: reservedCount,
          lastUpdated: new Date().toISOString()
        })
        .where(eq(stock.productId, product.id));
      
      const currentStock = stockData[0];
      const available = Math.max(0, currentStock.quantity - reservedCount);
      
      console.log(`   📦 ${product.name}: склад ${currentStock.quantity}, резерв ${reservedCount}, доступно ${available}`);
    }
    
    console.log('\n✅ ДАННЫЕ УСПЕШНО ИСПРАВЛЕНЫ И СИНХРОНИЗИРОВАНЫ!');
    console.log('🔄 Теперь все метрики рассчитываются автоматически на основе основных данных.');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении диагностики:', error);
  } finally {
    sqlite.close();
  }
}

// Запускаем диагностику и исправление
diagnoseAndFix(); 