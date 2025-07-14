#!/usr/bin/env node

/**
 * Скрипт диагностики и исправления проблем с остатками товаров
 * Использует централизованную систему управления остатками
 */

const { config } = require('dotenv');
const path = require('path');

// Загружаем переменные окружения
config({ path: path.join(__dirname, '.env') });

const { validateAllStock, fixStockInconsistencies, syncReservationsWithOrders, getStockStatistics } = require('./dist/utils/stockManager');

async function main() {
  console.log('🔍 Диагностика системы управления остатками...\n');

  try {
    // 1. Получаем общую статистику
    console.log('📊 Получение статистики остатков...');
    const stats = await getStockStatistics();
    
    console.log(`📦 Всего товаров: ${stats.total}`);
    console.log(`✅ Нормальные остатки: ${stats.normal}`);
    console.log(`⚠️  Низкие остатки: ${stats.low}`);
    console.log(`❌ Критичные остатки: ${stats.critical}`);
    console.log(`🔴 Отрицательные остатки: ${stats.negative}`);
    console.log(`⚡ Данные с ошибками: ${stats.invalidData}\n`);

    // 2. Проверяем целостность данных
    console.log('🔍 Проверка целостности данных...');
    const validation = await validateAllStock();
    
    console.log(`✅ Корректных записей: ${validation.valid}`);
    console.log(`❌ Некорректных записей: ${validation.invalid.length}\n`);

    if (validation.invalid.length > 0) {
      console.log('🚨 Найдены проблемы:');
      validation.invalid.forEach((item, index) => {
        console.log(`${index + 1}. Товар ID ${item.productId}:`);
        console.log(`   Остаток: ${item.currentStock}, Резерв: ${item.reservedStock}, Доступно: ${item.availableStock}`);
        console.log(`   Ошибки: ${item.errors?.join(', ')}`);
      });
      console.log();

      // Спрашиваем пользователя о исправлении
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const shouldFix = await new Promise((resolve) => {
        rl.question('🔧 Исправить найденные проблемы? (y/N): ', (answer) => {
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (shouldFix) {
        console.log('\n🔧 Исправление проблем...');
        
        // Фиктивный пользователь для системных операций (ID=1 - обычно admin)
        const systemUserId = 1;
        
        const fixResult = await fixStockInconsistencies(systemUserId);
        console.log(`✅ Исправлено записей: ${fixResult.fixed}`);
        
        if (fixResult.errors.length > 0) {
          console.log('❌ Ошибки при исправлении:');
          fixResult.errors.forEach(error => console.log(`   ${error}`));
        }
        
        // Синхронизируем резервы с заказами
        console.log('\n🔄 Синхронизация резервов с заказами...');
        const syncResult = await syncReservationsWithOrders(systemUserId);
        console.log(`✅ Синхронизировано записей: ${syncResult.synced}`);
        
        if (syncResult.errors.length > 0) {
          console.log('❌ Ошибки при синхронизации:');
          syncResult.errors.forEach(error => console.log(`   ${error}`));
        }

        // Повторная проверка
        console.log('\n🔍 Повторная проверка...');
        const newValidation = await validateAllStock();
        console.log(`✅ Корректных записей: ${newValidation.valid}`);
        console.log(`❌ Некорректных записей: ${newValidation.invalid.length}`);
        
        if (newValidation.invalid.length === 0) {
          console.log('🎉 Все проблемы исправлены!');
        } else {
          console.log('⚠️  Остались проблемы, требующие ручного вмешательства:');
          newValidation.invalid.forEach((item, index) => {
            console.log(`${index + 1}. Товар ID ${item.productId}: ${item.errors?.join(', ')}`);
          });
        }
      }

      rl.close();
    } else {
      console.log('🎉 Все данные корректны!');
    }

    // 3. Финальная статистика
    console.log('\n📊 Финальная статистика:');
    const finalStats = await getStockStatistics();
    console.log(`📦 Всего товаров: ${finalStats.total}`);
    console.log(`✅ Нормальные остатки: ${finalStats.normal}`);
    console.log(`⚠️  Низкие остатки: ${finalStats.low}`);
    console.log(`❌ Критичные остатки: ${finalStats.critical}`);
    console.log(`🔴 Отрицательные остатки: ${finalStats.negative}`);
    console.log(`⚡ Данные с ошибками: ${finalStats.invalidData}`);

  } catch (error) {
    console.error('❌ Ошибка при диагностике:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Диагностика завершена!');
  process.exit(0);
}

// Запускаем только если файл выполняется напрямую
if (require.main === module) {
  main();
} 