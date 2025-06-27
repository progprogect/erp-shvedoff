const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'mikitavalkunovich',
  password: '',
  database: 'erp_shvedoff'
});

async function seedCatalog() {
  try {
    console.log('🌱 Заполняем каталог тестовыми данными...\n');
    
    const client = await pool.connect();
    
    // Очищаем существующие данные
    await client.query('TRUNCATE TABLE stock CASCADE');
    await client.query('TRUNCATE TABLE products CASCADE');
    await client.query('TRUNCATE TABLE categories CASCADE');
    
    // Создаем категории
    console.log('📁 Создаем категории...');
    
    const categories = [
      // Основные категории
      { name: 'Лежаки резиновые', parentId: null, description: 'Резиновые маты для крупного рогатого скота' },
      { name: 'Коврики', parentId: null, description: 'Резиновые коврики различного назначения' },
      { name: 'Рулонные покрытия', parentId: null, description: 'Покрытия в рулонах' },
      { name: 'Крепежные изделия', parentId: null, description: 'Дюбели, винты, крепеж' },
    ];
    
    const categoryIds = {};
    
    for (const cat of categories) {
      const result = await client.query(
        `INSERT INTO categories (name, parent_id, description, sort_order, path, created_at, updated_at)
         VALUES ($1, $2, $3, 0, $1, NOW(), NOW()) RETURNING id`,
        [cat.name, cat.parentId, cat.description]
      );
      categoryIds[cat.name] = result.rows[0].id;
      console.log(`   ✅ ${cat.name} (ID: ${result.rows[0].id})`);
    }
    
    // Создаем подкатегории для лежаков
    const subCategories = [
      { name: 'Чешские (0 Чеш)', parentId: categoryIds['Лежаки резиновые'], description: 'Лежаки с рисунком "0 Чеш"' },
      { name: '3-Корончатые (3Кор)', parentId: categoryIds['Лежаки резиновые'], description: 'Лежаки с 3-корончатым рисунком' },
      { name: 'Брендовые', parentId: categoryIds['Лежаки резиновые'], description: 'Лежаки известных брендов' },
      { name: 'Кольцевые', parentId: categoryIds['Коврики'], description: 'Коврики кольцевые' },
      { name: 'Придверные', parentId: categoryIds['Коврики'], description: 'Коврики для входных зон' },
      { name: 'Дюбели', parentId: categoryIds['Крепежные изделия'], description: 'Различные типы дюбелей' }
    ];
    
    for (const cat of subCategories) {
      const parentPath = await client.query('SELECT path FROM categories WHERE id = $1', [cat.parentId]);
      const path = `${parentPath.rows[0].path} / ${cat.name}`;
      
      const result = await client.query(
        `INSERT INTO categories (name, parent_id, description, sort_order, path, created_at, updated_at)
         VALUES ($1, $2, $3, 0, $4, NOW(), NOW()) RETURNING id`,
        [cat.name, cat.parentId, cat.description, path]
      );
      categoryIds[cat.name] = result.rows[0].id;
      console.log(`   ✅ ${cat.name} (ID: ${result.rows[0].id})`);
    }
    
    // Создаем подкатегории для брендовых лежаков
    const brandCategories = [
      { name: 'GEA', parentId: categoryIds['Брендовые'], description: 'Лежаки бренда GEA' },
      { name: 'Agrotek', parentId: categoryIds['Брендовые'], description: 'Лежаки бренда Agrotek' },
      { name: 'Верблюд', parentId: categoryIds['Брендовые'], description: 'Лежаки бренда Верблюд' }
    ];
    
    for (const cat of brandCategories) {
      const parentPath = await client.query('SELECT path FROM categories WHERE id = $1', [cat.parentId]);
      const path = `${parentPath.rows[0].path} / ${cat.name}`;
      
      const result = await client.query(
        `INSERT INTO categories (name, parent_id, description, sort_order, path, created_at, updated_at)
         VALUES ($1, $2, $3, 0, $4, NOW(), NOW()) RETURNING id`,
        [cat.name, cat.parentId, cat.description, path]
      );
      categoryIds[cat.name] = result.rows[0].id;
      console.log(`   ✅ ${cat.name} (ID: ${result.rows[0].id})`);
    }
    
    console.log('\n📦 Создаем товары...');
    
    // Создаем товары
    const products = [
      // Чешские лежаки
      {
        name: 'Лежак 0 Чеш 1800×1200×30',
        article: 'LCH-1800-1200-30',
        categoryId: categoryIds['Чешские (0 Чеш)'],
        dimensions: JSON.stringify({ length: 1800, width: 1200, height: 30 }),
        characteristics: JSON.stringify({ surface: 'чертёная', material: 'резина', weight: 45 }),
        price: '15430.00',
        normStock: 100,
        currentStock: 145,
        notes: 'Популярный размер для молочных ферм'
      },
      {
        name: 'Лежак 0 Чеш 1800×1200×35',
        article: 'LCH-1800-1200-35',
        categoryId: categoryIds['Чешские (0 Чеш)'],
        dimensions: JSON.stringify({ length: 1800, width: 1200, height: 35 }),
        characteristics: JSON.stringify({ surface: 'чертёная', material: 'резина', weight: 52 }),
        price: '16780.00',
        normStock: 50,
        currentStock: 89,
        notes: 'Увеличенная толщина для дополнительного комфорта'
      },
      {
        name: 'Лежак 0 Чеш 1800×1200×40',
        article: 'LCH-1800-1200-40',
        categoryId: categoryIds['Чешские (0 Чеш)'],
        dimensions: JSON.stringify({ length: 1800, width: 1200, height: 40 }),
        characteristics: JSON.stringify({ surface: 'чертёная', material: 'резина', weight: 60 }),
        price: '18920.00',
        normStock: 80,
        currentStock: 2,
        notes: 'Максимальная толщина для особого комфорта'
      },
      
      // Брендовые лежаки
      {
        name: 'Лежак GEA 1800×1200 2ст пазл',
        article: 'GEA-1800-1200-2ST',
        categoryId: categoryIds['GEA'],
        dimensions: JSON.stringify({ length: 1800, width: 1200, height: 32 }),
        characteristics: JSON.stringify({ surface: 'пазловая', material: 'резина', brand: 'GEA' }),
        price: '22350.00',
        normStock: 30,
        currentStock: 0,
        notes: 'Пазловая поверхность для лучшего сцепления'
      },
      {
        name: 'Лежак Agrotek Comfort 1800×1200',
        article: 'AGT-COMFORT-1800',
        categoryId: categoryIds['Agrotek'],
        dimensions: JSON.stringify({ length: 1800, width: 1200, height: 35 }),
        characteristics: JSON.stringify({ surface: 'рифлёная', material: 'резина', brand: 'Agrotek' }),
        price: '19850.00',
        normStock: 25,
        currentStock: 18,
        notes: 'Эргономичный дизайн для максимального комфорта'
      },
      
      // Коврики
      {
        name: 'Коврик кольцевой 600×400 СТАР',
        article: 'KK-600-400-STAR',
        categoryId: categoryIds['Кольцевые'],
        dimensions: JSON.stringify({ length: 600, width: 400, height: 15 }),
        characteristics: JSON.stringify({ surface: 'кольцевая', material: 'резина', pattern: 'звезда' }),
        price: '2850.00',
        normStock: 50,
        currentStock: 8,
        notes: 'Универсальный коврик для различных зон'
      },
      {
        name: 'Коврик придверный 800×600 Классик',
        article: 'KP-800-600-CLASSIC',
        categoryId: categoryIds['Придверные'],
        dimensions: JSON.stringify({ length: 800, width: 600, height: 12 }),
        characteristics: JSON.stringify({ surface: 'рифлёная', material: 'резина', type: 'классик' }),
        price: '3420.00',
        normStock: 30,
        currentStock: 15,
        notes: 'Идеален для входных групп'
      },
      
      // Крепеж
      {
        name: 'Дюбель 10×80мм',
        article: 'DYB-10-80',
        categoryId: categoryIds['Дюбели'],
        dimensions: JSON.stringify({ diameter: 10, length: 80 }),
        characteristics: JSON.stringify({ material: 'пластик', head: 'потайная' }),
        price: '12.50',
        normStock: 1000,
        currentStock: 145,
        notes: 'Стандартный крепеж для резиновых покрытий'
      },
      {
        name: 'Дюбель 12×100мм усиленный',
        article: 'DYB-12-100-USI',
        categoryId: categoryIds['Дюбели'],
        dimensions: JSON.stringify({ diameter: 12, length: 100 }),
        characteristics: JSON.stringify({ material: 'пластик_усиленный', head: 'шестигранная' }),
        price: '18.75',
        normStock: 500,
        currentStock: 67,
        notes: 'Усиленный крепеж для тяжелых покрытий'
      }
    ];
    
    for (const product of products) {
      // Создаем товар
      const result = await client.query(
        `INSERT INTO products (name, article, category_id, dimensions, characteristics, price, norm_stock, notes, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW()) RETURNING id`,
        [
          product.name,
          product.article,
          product.categoryId,
          product.dimensions,
          product.characteristics,
          product.price,
          product.normStock,
          product.notes
        ]
      );
      
      const productId = result.rows[0].id;
      
      // Создаем остатки
      await client.query(
        `INSERT INTO stock (product_id, current_stock, reserved_stock, updated_at)
         VALUES ($1, $2, 0, NOW())`,
        [productId, product.currentStock]
      );
      
      console.log(`   ✅ ${product.name} (остаток: ${product.currentStock} шт)`);
    }
    
    client.release();
    console.log('\n🎉 Каталог успешно заполнен!');
    console.log('\n📊 Создано:');
    console.log(`   📁 Категорий: ${categories.length + subCategories.length + brandCategories.length}`);
    console.log(`   📦 Товаров: ${products.length}`);
    console.log('\n🔍 Можно тестировать поиск по товарам (минимум 3 символа)');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

seedCatalog(); 