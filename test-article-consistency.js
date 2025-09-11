const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

// Тестовые данные для создания товара
const testProductData = {
  name: 'Тестовый ковер для проверки консистентности',
  productType: 'carpet',
  categoryId: 1, // Предполагаем что есть категория с ID 1
  materialId: 1, // Предполагаем что есть материал с ID 1
  logoId: 1, // Предполагаем что есть логотип с ID 1
  surfaceIds: [1, 2], // Предполагаем что есть поверхности с ID 1, 2
  bottomTypeId: 1, // Предполагаем что есть тип низа с ID 1
  pressType: 'ukrainian',
  borderType: 'with_border',
  carpetEdgeType: 'direct_cut',
  carpetEdgeSides: 2,
  carpetEdgeStrength: 'strong',
  grade: 'usual',
  dimensions: {
    length: 2000,
    width: 1500,
    thickness: 10
  }
};

async function testArticleConsistency() {
  try {
    console.log('🧪 Тестирование консистентности генерации артикулов...\n');

    // 1. Создаем товар и получаем артикул
    console.log('1️⃣ Создаем товар...');
    const createResponse = await axios.post(`${API_BASE_URL}/catalog/products`, testProductData, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE', // Замените на реальный токен
        'Content-Type': 'application/json'
      }
    });

    if (!createResponse.data.success) {
      throw new Error(`Ошибка создания товара: ${createResponse.data.error}`);
    }

    const createdProduct = createResponse.data.data;
    const createdArticle = createdProduct.article;
    console.log(`✅ Товар создан с артикулом: ${createdArticle}`);

    // 2. Перегенерируем артикул для того же товара
    console.log('\n2️⃣ Перегенерируем артикул...');
    const regenerateResponse = await axios.post(`${API_BASE_URL}/catalog/regenerate/dry-run`, {
      productIds: [createdProduct.id]
    }, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE', // Замените на реальный токен
        'Content-Type': 'application/json'
      }
    });

    if (!regenerateResponse.data.success) {
      throw new Error(`Ошибка перегенерации: ${regenerateResponse.data.error}`);
    }

    const regenerateResult = regenerateResponse.data.data.results[0];
    const regeneratedArticle = regenerateResult.newSku;
    console.log(`✅ Перегенерированный артикул: ${regeneratedArticle}`);

    // 3. Сравниваем результаты
    console.log('\n3️⃣ Сравнение результатов:');
    console.log(`Создание:    ${createdArticle}`);
    console.log(`Перегенерация: ${regeneratedArticle}`);
    
    if (createdArticle === regeneratedArticle) {
      console.log('✅ УСПЕХ: Артикулы идентичны!');
    } else {
      console.log('❌ ОШИБКА: Артикулы различаются!');
      console.log('🔍 Анализ различий:');
      
      // Простой анализ различий
      const createdParts = createdArticle.split('-');
      const regeneratedParts = regeneratedArticle.split('-');
      
      console.log(`Частей в созданном: ${createdParts.length}`);
      console.log(`Частей в перегенерированном: ${regeneratedParts.length}`);
      
      for (let i = 0; i < Math.max(createdParts.length, regeneratedParts.length); i++) {
        const createdPart = createdParts[i] || 'ОТСУТСТВУЕТ';
        const regeneratedPart = regeneratedParts[i] || 'ОТСУТСТВУЕТ';
        
        if (createdPart !== regeneratedPart) {
          console.log(`  Часть ${i + 1}: "${createdPart}" vs "${regeneratedPart}"`);
        }
      }
    }

    // 4. Очистка - удаляем тестовый товар
    console.log('\n4️⃣ Очистка...');
    try {
      await axios.delete(`${API_BASE_URL}/catalog/products/${createdProduct.id}`, {
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN_HERE'
        }
      });
      console.log('✅ Тестовый товар удален');
    } catch (cleanupError) {
      console.log('⚠️ Не удалось удалить тестовый товар:', cleanupError.message);
    }

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    if (error.response) {
      console.error('Детали ответа:', error.response.data);
    }
  }
}

// Запускаем тест
testArticleConsistency();
