// Тестирование генератора артикулов
const { generateArticle, validateProductData, previewArticle } = require('./backend/src/utils/articleGenerator.ts');

// Тестовые данные
const testProducts = [
  {
    name: 'МАТ',
    dimensions: { length: 1750, width: 1200, thickness: 24 },
    material: { name: 'GEA' },
    pressType: 'ukrainian',
    surfaces: [{ name: 'Чешуйки' }],
    borderType: 'with_border',
    carpetEdgeType: 'puzzle',
    carpetEdgeSides: 4,
    carpetEdgeStrength: 'normal',
    puzzleType: { name: 'старый' },
    bottomType: { code: 'Ш5' },
    grade: 'grade_2'
  },
  {
    name: '1 коровка',
    dimensions: { length: 1000, width: 800, thickness: 20 },
    material: { name: 'резина' },
    pressType: 'not_selected',
    surfaces: [{ name: '1 коровка' }],
    borderType: 'without_border',
    carpetEdgeType: 'straight_cut',
    grade: 'usual'
  },
  {
    name: 'коровка',
    dimensions: { length: 1500, width: 1000, thickness: 15 },
    surfaces: [{ name: 'Чешуйки' }, { name: 'Черточки' }],
    grade: 'telyatnik'
  }
];

console.log('=== Тестирование генератора артикулов ===\n');

testProducts.forEach((product, index) => {
  console.log(`Тест ${index + 1}:`);
  console.log('Входные данные:', JSON.stringify(product, null, 2));
  
  try {
    const article = generateArticle(product);
    console.log('Сгенерированный артикул:', article);
    
    const validation = validateProductData(product);
    console.log('Валидация:', validation.isValid ? 'OK' : `Ошибки: ${validation.errors.join(', ')}`);
  } catch (error) {
    console.log('ОШИБКА:', error.message);
  }
  
  console.log('---\n');
});

// Тест предварительного просмотра
console.log('=== Тест предварительного просмотра ===');
const partialProduct = {
  name: 'МАТ',
  dimensions: { length: 1500, width: 1000 }
};

const preview = previewArticle(partialProduct);
console.log('Частичные данные:', JSON.stringify(partialProduct, null, 2));
console.log('Предварительный просмотр:', preview);
