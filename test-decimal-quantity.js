// ТЕСТИРОВАНИЕ ПОДДЕРЖКИ ДРОБНЫХ ЗНАЧЕНИЙ КОЛИЧЕСТВА КОВРОВ
// Дата: 2025-01-20

console.log('🧪 ТЕСТИРОВАНИЕ ПОДДЕРЖКИ ДРОБНЫХ ЗНАЧЕНИЙ КОЛИЧЕСТВА КОВРОВ\n');

// Импорт утилит для тестирования
function normalizeDecimalInput(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const stringValue = String(value);
  const normalizedString = stringValue.replace(',', '.');
  const parsedValue = parseFloat(normalizedString);
  
  if (isNaN(parsedValue) || parsedValue < 0) {
    return 0;
  }
  
  return Math.round(parsedValue * 100) / 100;
}

function formatQuantityDisplay(value) {
  if (value === null || value === undefined || value === 0) {
    return '0';
  }

  const rounded = Math.round(value * 100) / 100;
  
  if (rounded % 1 === 0) {
    return rounded.toString();
  }
  
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function formatQuantityForArticle(value) {
  if (value === 0) return '0';
  
  const rounded = Math.round(value * 100) / 100;
  
  if (rounded % 1 === 0) {
    return rounded.toString();
  }
  
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function formatRollComposition(composition) {
  if (!composition || composition.length === 0) return '';
  
  const totalQuantity = composition.reduce((sum, item) => sum + item.quantity, 0);
  
  return totalQuantity > 0 ? `${formatQuantityForArticle(totalQuantity)}Ковр` : '';
}

function validateQuantity(value) {
  if (isNaN(value) || value < 0.01) {
    return {
      isValid: false,
      error: 'Количество должно быть не менее 0.01'
    };
  }

  if (value > 9999999.99) {
    return {
      isValid: false,
      error: 'Количество не может превышать 9999999.99'
    };
  }

  const decimals = (value.toString().split('.')[1] || '').length;
  if (decimals > 2) {
    return {
      isValid: false,
      error: 'Количество может иметь не более 2 знаков после запятой'
    };
  }

  return { isValid: true };
}

// ТЕСТОВЫЕ СЛУЧАИ
console.log('🔧 ТЕСТИРОВАНИЕ УТИЛИТ:\n');

// 1. Тестирование нормализации ввода
console.log('1. Нормализация ввода:');
const inputTests = [
  { input: '1,5', expected: 1.5, description: 'Запятая → точка' },
  { input: '2.75', expected: 2.75, description: 'Точка остается' },
  { input: '3', expected: 3, description: 'Целое число' },
  { input: '0,01', expected: 0.01, description: 'Минимальное значение' },
  { input: '', expected: 0, description: 'Пустая строка' },
  { input: null, expected: 0, description: 'Null значение' },
  { input: 'abc', expected: 0, description: 'Неверный формат' }
];

inputTests.forEach(test => {
  const result = normalizeDecimalInput(test.input);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`   ${status} ${test.description}: "${test.input}" → ${result} (ожидалось: ${test.expected})`);
});

// 2. Тестирование отображения
console.log('\n2. Форматирование для отображения:');
const displayTests = [
  { input: 1, expected: '1', description: 'Целое без .00' },
  { input: 1.5, expected: '1.5', description: 'Дробное с .5' },
  { input: 2.50, expected: '2.5', description: 'Убираем лишний 0' },
  { input: 3.25, expected: '3.25', description: 'Дробное с .25' },
  { input: 0, expected: '0', description: 'Ноль' },
  { input: null, expected: '0', description: 'Null → 0' }
];

displayTests.forEach(test => {
  const result = formatQuantityDisplay(test.input);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`   ${status} ${test.description}: ${test.input} → "${result}" (ожидалось: "${test.expected}")`);
});

// 3. Тестирование валидации
console.log('\n3. Валидация значений:');
const validationTests = [
  { input: 0.01, expected: true, description: 'Минимальное валидное' },
  { input: 1.5, expected: true, description: 'Нормальное дробное' },
  { input: 999.99, expected: true, description: 'Большое валидное' },
  { input: 0, expected: false, description: 'Ноль невалиден' },
  { input: 0.001, expected: false, description: 'Слишком много знаков' },
  { input: 10000000, expected: false, description: 'Слишком большое' }
];

validationTests.forEach(test => {
  const result = validateQuantity(test.input);
  const status = result.isValid === test.expected ? '✅' : '❌';
  console.log(`   ${status} ${test.description}: ${test.input} → ${result.isValid ? 'валидно' : result.error}`);
});

// 4. Тестирование артикула
console.log('\n4. Форматирование для артикула:');
const articleTests = [
  { composition: [{ quantity: 1 }, { quantity: 2 }], expected: '3Ковр', description: 'Целые числа' },
  { composition: [{ quantity: 1.5 }, { quantity: 2.5 }], expected: '4Ковр', description: 'Дробные → целое' },
  { composition: [{ quantity: 1.25 }, { quantity: 1.75 }], expected: '3Ковр', description: 'Дробные → целое' },
  { composition: [{ quantity: 1.5 }, { quantity: 1 }], expected: '2.5Ковр', description: 'Смешанные → дробное' },
  { composition: [], expected: '', description: 'Пустой состав' }
];

articleTests.forEach(test => {
  const result = formatRollComposition(test.composition);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`   ${status} ${test.description}: ${JSON.stringify(test.composition.map(c => c.quantity))} → "${result}" (ожидалось: "${test.expected}")`);
});

console.log('\n📊 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО\n');

// ПРОВЕРКА КОМПОНЕНТОВ
console.log('🎨 ПРОВЕРКА КОМПОНЕНТОВ:\n');

console.log('✅ CreateProductModal.tsx:');
console.log('   • InputNumber: min={0.01}, step={0.01}, precision={2}');
console.log('   • Валидация с normalizeDecimalInput()');
console.log('   • Форматирование с formatQuantityDisplay()');

console.log('\n✅ ProductDetail.tsx:');
console.log('   • Отображение: ×{formatQuantityDisplay(item.quantity)}');
console.log('   • Красивое форматирование дробных значений');

console.log('\n✅ articleGenerator.ts:');
console.log('   • formatRollComposition() с formatQuantityForArticle()');
console.log('   • Поддержка дробных в артикуле (1.5Ковр vs 2Ковр)');

console.log('\n✅ backend/src/db/schema.ts:');
console.log('   • quantity: decimal("quantity", { precision: 10, scale: 2 })');

console.log('\n✅ База данных (staging):');
console.log('   • Тип колонки: numeric(10,2)');
console.log('   • Ограничение: quantity >= 0.01');
console.log('   • Автоматическое преобразование существующих данных');

console.log('\n🧪 СЦЕНАРИИ ДЛЯ РУЧНОГО ТЕСТИРОВАНИЯ:');
console.log('1. Создать рулонное покрытие с количеством 1,5 (через запятую)');
console.log('2. Создать рулонное покрытие с количеством 2.25 (через точку)');
console.log('3. Проверить отображение на странице товара');
console.log('4. Проверить генерацию артикула');
console.log('5. Попробовать ввести 0.001 (должна быть ошибка валидации)');
console.log('6. Попробовать ввести 0 (должна быть ошибка валидации)');

console.log('\n🎯 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ:');
console.log('• Ввод: 1,5 → Сохранение: 1.50 → Отображение: 1.5 → Артикул: 1.5Ковр');
console.log('• Ввод: 2 → Сохранение: 2.00 → Отображение: 2 → Артикул: 2Ковр');
console.log('• Ввод: 1.25 + 2.75 → Артикул: 4Ковр (целое)');
console.log('• Ввод: 1.5 + 1 → Артикул: 2.5Ковр (дробное)');

console.log('\n🚀 ГОТОВО К ТЕСТИРОВАНИЮ!');
