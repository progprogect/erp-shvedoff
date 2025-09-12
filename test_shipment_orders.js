// Тестовый скрипт для проверки функционала множественных заказов в отгрузках
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

// Тестовые данные
const testData = {
  username: 'director',
  password: '123456'
};

async function testShipmentOrders() {
  try {
    console.log('🧪 Начинаем тестирование функционала множественных заказов в отгрузках...\n');

    // 1. Авторизация
    console.log('1️⃣ Авторизация...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, testData);
    const token = loginResponse.data.token;
    console.log('✅ Авторизация успешна\n');

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Получаем готовые заказы
    console.log('2️⃣ Получаем готовые заказы...');
    const readyOrdersResponse = await axios.get(`${API_BASE_URL}/shipments/ready-orders`, { headers });
    const readyOrders = readyOrdersResponse.data.data;
    console.log(`✅ Найдено ${readyOrders.length} готовых заказов`);
    
    if (readyOrders.length > 0) {
      console.log('Готовые заказы:');
      readyOrders.forEach(order => {
        console.log(`  - ${order.orderNumber}: ${order.customerName}`);
      });
    }
    console.log('');

    // 3. Создаем тестовые заказы если их нет
    if (readyOrders.length < 2) {
      console.log('3️⃣ Создаем тестовые заказы...');
      
      const testOrders = [
        {
          customerName: 'Тестовый клиент 1',
          customerContact: '+7 999 123 45 67',
          priority: 'normal',
          items: [
            { productId: 1, quantity: 5, price: 1000 }
          ]
        },
        {
          customerName: 'Тестовый клиент 2', 
          customerContact: '+7 999 765 43 21',
          priority: 'high',
          items: [
            { productId: 2, quantity: 3, price: 1500 }
          ]
        }
      ];

      for (const orderData of testOrders) {
        try {
          const createOrderResponse = await axios.post(`${API_BASE_URL}/orders`, orderData, { headers });
          console.log(`✅ Создан заказ: ${createOrderResponse.data.data.orderNumber}`);
        } catch (error) {
          console.log(`⚠️ Ошибка создания заказа: ${error.response?.data?.message || error.message}`);
        }
      }
      console.log('');
    }

    // 4. Получаем обновленный список готовых заказов
    console.log('4️⃣ Получаем обновленный список готовых заказов...');
    const updatedReadyOrdersResponse = await axios.get(`${API_BASE_URL}/shipments/ready-orders`, { headers });
    const updatedReadyOrders = updatedReadyOrdersResponse.data.data;
    console.log(`✅ Найдено ${updatedReadyOrders.length} готовых заказов\n`);

    if (updatedReadyOrders.length >= 2) {
      // 5. Создаем отгрузку с множественными заказами
      console.log('5️⃣ Создаем отгрузку с множественными заказами...');
      const orderIds = updatedReadyOrders.slice(0, 2).map(order => order.id);
      
      const shipmentData = {
        orderIds: orderIds,
        plannedDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // завтра
        transportInfo: 'Тестовый транспорт',
        notes: 'Тестовая отгрузка с множественными заказами'
      };

      const createShipmentResponse = await axios.post(`${API_BASE_URL}/shipments`, shipmentData, { headers });
      const newShipment = createShipmentResponse.data.data;
      console.log(`✅ Создана отгрузка: ${newShipment.shipmentNumber}`);
      console.log(`   Связанные заказы: ${orderIds.join(', ')}\n`);

      // 6. Получаем детали отгрузки
      console.log('6️⃣ Получаем детали отгрузки...');
      const shipmentDetailsResponse = await axios.get(`${API_BASE_URL}/shipments/${newShipment.id}`, { headers });
      const shipmentDetails = shipmentDetailsResponse.data.data;
      
      console.log(`✅ Отгрузка ${shipmentDetails.shipmentNumber}:`);
      console.log(`   Статус: ${shipmentDetails.status}`);
      console.log(`   Связанные заказы: ${shipmentDetails.relatedOrders?.length || 0}`);
      
      if (shipmentDetails.relatedOrders && shipmentDetails.relatedOrders.length > 0) {
        shipmentDetails.relatedOrders.forEach(order => {
          console.log(`     - ${order.orderNumber}: ${order.customerName}`);
        });
      }
      console.log('');

      // 7. Получаем список всех отгрузок
      console.log('7️⃣ Получаем список всех отгрузок...');
      const shipmentsResponse = await axios.get(`${API_BASE_URL}/shipments`, { headers });
      const shipments = shipmentsResponse.data.data;
      
      console.log(`✅ Найдено ${shipments.length} отгрузок:`);
      shipments.forEach(shipment => {
        const orders = shipment.orders?.map(so => so.order) || shipment.relatedOrders || [];
        console.log(`   - ${shipment.shipmentNumber}: ${orders.length} заказов`);
        if (orders.length > 0) {
          orders.forEach(order => {
            console.log(`     * ${order.orderNumber}: ${order.customerName}`);
          });
        }
      });
      console.log('');

      // 8. Тестируем валидацию - пытаемся создать отгрузку с уже привязанными заказами
      console.log('8️⃣ Тестируем валидацию (попытка создать отгрузку с уже привязанными заказами)...');
      try {
        const duplicateShipmentData = {
          orderIds: orderIds, // те же заказы
          plannedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          transportInfo: 'Дублирующая отгрузка'
        };
        
        await axios.post(`${API_BASE_URL}/shipments`, duplicateShipmentData, { headers });
        console.log('❌ Ошибка: валидация не сработала!');
      } catch (error) {
        console.log(`✅ Валидация работает: ${error.response?.data?.message}`);
      }
      console.log('');

    } else {
      console.log('⚠️ Недостаточно готовых заказов для тестирования множественных отгрузок');
    }

    console.log('🎉 Тестирование завершено успешно!');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.response?.data?.message || error.message);
    console.error('Детали:', error.response?.data || error.message);
  }
}

// Запускаем тест
testShipmentOrders();
