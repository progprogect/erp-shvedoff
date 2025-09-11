const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function testSecondGradeCutting() {
  try {
    console.log('🔍 Тестирование учета 2-го сорта при завершении операций резки...\n');

    // 1. Логинимся как директор
    console.log('1. Авторизация директора...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      username: 'director',
      password: '123456'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Ошибка авторизации:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Авторизация успешна');

    // 2. Создаем тестовую операцию резки
    console.log('\n2. Создание тестовой операции резки...');
    const cuttingResponse = await axios.post(`${API_BASE}/cutting`, {
      sourceProductId: 155,
      targetProductId: 155,
      sourceQuantity: 10,
      targetQuantity: 8,
      plannedDate: '2025-09-29T21:00:00.000Z',
      assignedTo: 1
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!cuttingResponse.data.success) {
      console.log('❌ Ошибка создания операции резки:', cuttingResponse.data.message);
      return;
    }

    const operationId = cuttingResponse.data.data.id;
    console.log('✅ Операция резки создана, ID:', operationId);

    // 3. Завершаем операцию с указанием 2-го сорта
    console.log('\n3. Завершение операции с учетом 2-го сорта...');
    const completeResponse = await axios.put(`${API_BASE}/cutting/${operationId}/complete`, {
      actualTargetQuantity: 6,  // Готово
      actualSecondGradeQuantity: 2,  // 2 сорт
      actualDefectQuantity: 2,  // Брак
      notes: 'Тестовая операция с учетом 2-го сорта'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!completeResponse.data.success) {
      console.log('❌ Ошибка завершения операции:', completeResponse.data.message);
      return;
    }

    console.log('✅ Операция завершена успешно!');
    console.log('📊 Результат:', completeResponse.data.message);

    // 4. Проверяем что товар 2-го сорта создался
    console.log('\n4. Проверка создания товара 2-го сорта...');
    const productsResponse = await axios.get(`${API_BASE}/catalog/products?search=2С`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (productsResponse.data.success) {
      const secondGradeProducts = productsResponse.data.data.filter(p => 
        p.article && p.article.includes('-2С') && p.grade === 'grade_2'
      );
      
      if (secondGradeProducts.length > 0) {
        console.log('✅ Товар 2-го сорта найден:', secondGradeProducts[0].article);
        console.log('📋 Детали:', {
          name: secondGradeProducts[0].name,
          article: secondGradeProducts[0].article,
          grade: secondGradeProducts[0].grade
        });
      } else {
        console.log('❌ Товар 2-го сорта не найден');
      }
    }

    // 5. Проверяем остатки
    console.log('\n5. Проверка остатков...');
    const stockResponse = await axios.get(`${API_BASE}/stock`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (stockResponse.data.success) {
      const targetStock = stockResponse.data.data.find(s => s.productId === 155);
      if (targetStock) {
        console.log('📦 Остаток целевого товара:', targetStock.currentStock);
      }
    }

    console.log('\n🎉 Тест завершен успешно!');

  } catch (error) {
    console.error('❌ Ошибка теста:', error.response?.data || error.message);
  }
}

testSecondGradeCutting();
