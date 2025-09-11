const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testArticleConsistency() {
  try {
    console.log('🧪 Тестирование консистентности генерации артикулов...\n');

    // 1. Получаем список товаров
    console.log('1️⃣ Получаем список товаров...');
    const productsResponse = await axios.get(`${API_BASE_URL}/catalog/products?page=1&limit=5`, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE', // Замените на реальный токен
        'Content-Type': 'application/json'
      }
    });

    if (!productsResponse.data.success) {
      throw new Error(`Ошибка получения товаров: ${productsResponse.data.error}`);
    }

    const products = productsResponse.data.data.products;
    console.log(`✅ Найдено товаров: ${products.length}`);

    if (products.length === 0) {
      console.log('⚠️ Нет товаров для тестирования');
      return;
    }

    // 2. Тестируем перегенерацию для каждого товара
    for (let i = 0; i < Math.min(3, products.length); i++) {
      const product = products[i];
      console.log(`\n2️⃣ Тестируем товар #${i + 1}: "${product.name}"`);
      console.log(`   Текущий артикул: ${product.article || 'НЕТ'}`);

      try {
        // Перегенерируем артикул
        const regenerateResponse = await axios.post(`${API_BASE_URL}/catalog/regenerate/dry-run`, {
          productIds: [product.id]
        }, {
          headers: {
            'Authorization': 'Bearer YOUR_TOKEN_HERE',
            'Content-Type': 'application/json'
          }
        });

        if (regenerateResponse.data.success) {
          const result = regenerateResponse.data.data.results[0];
          console.log(`   Новый артикул: ${result.newSku || 'НЕ СГЕНЕРИРОВАН'}`);
          console.log(`   Статус: ${result.canApply ? '✅ МОЖНО ПРИМЕНИТЬ' : '❌ ОШИБКА'}`);
          
          if (!result.canApply && result.details) {
            console.log(`   Причина: ${result.details.join(', ')}`);
          }
        } else {
          console.log(`   ❌ Ошибка перегенерации: ${regenerateResponse.data.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
      }
    }

    console.log('\n✅ Тестирование завершено');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    if (error.response) {
      console.error('Детали ответа:', error.response.data);
    }
  }
}

// Запускаем тест
testArticleConsistency();
