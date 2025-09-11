const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

// Тестовые данные для ПУР
const purProduct = {
  name: 'Тестовый ПУР',
  productType: 'pur',
  purNumber: 12345,
  dimensions: {
    length: 1000,
    width: 800,
    thickness: 5
  },
  price: '1500.00',
  costPrice: '1200.00',
  article: 'PUR-12345' // Ручной артикул
};

// Тестовые данные для "Другое"
const otherProduct = {
  name: 'Тестовое другое',
  productType: 'other',
  dimensions: {
    length: 500,
    width: 300,
    thickness: 2
  },
  price: '800.00',
  costPrice: '600.00',
  article: 'OTHER-001' // Ручной артикул
};

// Тестовые данные для ковра (для сравнения)
const carpetProduct = {
  name: 'Тестовый ковер',
  productType: 'carpet',
  dimensions: {
    length: 1200,
    width: 800,
    thickness: 12
  },
  price: '2000.00',
  costPrice: '1600.00',
  article: 'CARPET-TEST' // Ручной артикул
};

async function createTestProducts() {
  console.log('🧪 Создание тестовых товаров...');
  
  const products = [];
  
  try {
    // Создаем ПУР
    const purResponse = await axios.post(`${API_BASE}/catalog/products`, purProduct);
    console.log('✅ ПУР создан:', purResponse.data.id, purResponse.data.article);
    products.push(purResponse.data);
  } catch (error) {
    console.error('❌ Ошибка создания ПУР:', error.response?.data || error.message);
  }
  
  try {
    // Создаем "Другое"
    const otherResponse = await axios.post(`${API_BASE}/catalog/products`, otherProduct);
    console.log('✅ "Другое" создано:', otherResponse.data.id, otherResponse.data.article);
    products.push(otherResponse.data);
  } catch (error) {
    console.error('❌ Ошибка создания "Другое":', error.response?.data || error.message);
  }
  
  try {
    // Создаем ковер
    const carpetResponse = await axios.post(`${API_BASE}/catalog/products`, carpetProduct);
    console.log('✅ Ковер создан:', carpetResponse.data.id, carpetResponse.data.article);
    products.push(carpetResponse.data);
  } catch (error) {
    console.error('❌ Ошибка создания ковра:', error.response?.data || error.message);
  }
  
  return products;
}

async function testRegeneration(products) {
  console.log('\n🧪 Тестирование перегенерации...');
  
  if (products.length === 0) {
    console.log('❌ Нет товаров для тестирования');
    return;
  }
  
  try {
    const productIds = products.map(p => p.id);
    
    // Dry run
    const dryRunResponse = await axios.post(`${API_BASE}/catalog/regenerate/dry-run`, {
      productIds
    });
    
    console.log('✅ Dry run выполнен:');
    console.log('   Можно обновить:', dryRunResponse.data.canApplyCount);
    console.log('   Нельзя обновить:', dryRunResponse.data.cannotApplyCount);
    
    // Показываем детали для каждого товара
    dryRunResponse.data.results.forEach(result => {
      const product = products.find(p => p.id === result.productId);
      console.log(`\n   📦 Товар: ${product?.name} (${product?.productType})`);
      console.log(`     ID: ${result.productId}`);
      console.log(`     Текущий артикул: ${result.currentSku}`);
      console.log(`     Новый артикул: ${result.newSku}`);
      console.log(`     Можно применить: ${result.canApply}`);
      console.log(`     Причина: ${result.reason || 'Нет'}`);
      if (result.details) {
        console.log(`     Детали: ${result.details.join(', ')}`);
      }
    });
    
    // Проверяем что ПУРы и "Другое" не могут быть обновлены
    const purResults = dryRunResponse.data.results.filter(r => {
      const product = products.find(p => p.id === r.productId);
      return product?.productType === 'pur' || product?.productType === 'other';
    });
    
    const carpetResults = dryRunResponse.data.results.filter(r => {
      const product = products.find(p => p.id === r.productId);
      return product?.productType === 'carpet';
    });
    
    console.log('\n📊 Анализ результатов:');
    console.log(`   ПУРы и "Другое": ${purResults.length} товаров`);
    purResults.forEach(r => {
      console.log(`     - ${r.canApply ? '❌ ОШИБКА: можно применить' : '✅ Правильно: нельзя применить'} (${r.reason})`);
    });
    
    console.log(`   Ковры: ${carpetResults.length} товаров`);
    carpetResults.forEach(r => {
      console.log(`     - ${r.canApply ? '✅ Правильно: можно применить' : '❌ ОШИБКА: нельзя применить'} (${r.reason || 'Нет причины'})`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка перегенерации:', error.response?.data || error.message);
  }
}

async function cleanup(products) {
  console.log('\n🧹 Очистка тестовых данных...');
  
  for (const product of products) {
    if (product) {
      try {
        await axios.delete(`${API_BASE}/catalog/products/${product.id}`);
        console.log(`   Удален товар ${product.id}: ${product.name}`);
      } catch (error) {
        console.log(`   Ошибка удаления товара ${product.id}:`, error.response?.data?.message || error.message);
      }
    }
  }
}

async function main() {
  console.log('🚀 Тестирование перегенерации для ПУРов и "Другое"\n');
  
  // Создаем тестовые товары
  const products = await createTestProducts();
  
  // Тестируем перегенерацию
  await testRegeneration(products);
  
  // Очищаем
  await cleanup(products);
  
  console.log('\n✅ Тестирование завершено!');
}

main().catch(console.error);
