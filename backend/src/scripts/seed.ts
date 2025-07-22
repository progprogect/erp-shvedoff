import bcrypt from 'bcryptjs';
import { db, schema } from '../db';

const seedUsers = async () => {
  console.log('🌱 Seeding users...');
  
  const users = [
    {
      username: 'director',
      passwordHash: await bcrypt.hash('123456', 10),
      role: 'director' as const,
      fullName: 'Директор по продажам',
      phone: '+7-999-123-45-67',
      email: 'director@shvedoff.ru'
    },
    {
      username: 'manager1',
      passwordHash: await bcrypt.hash('123456', 10),
      role: 'manager' as const,
      fullName: 'Менеджер по продажам #1',
      phone: '+7-999-123-45-68',
      email: 'manager1@shvedoff.ru'
    },
    {
      username: 'production1',
      passwordHash: await bcrypt.hash('123456', 10),
      role: 'production' as const,
      fullName: 'Сотрудник производства #1',
      phone: '+7-999-123-45-69',
      email: 'production1@shvedoff.ru'
    },
    {
      username: 'warehouse1',
      passwordHash: await bcrypt.hash('123456', 10),
      role: 'warehouse' as const,
      fullName: 'Сотрудник склада/Охрана #1',
      phone: '+7-999-123-45-70',
      email: 'warehouse1@shvedoff.ru'
    }
  ];

  await db.insert(schema.users).values(users).onConflictDoNothing();
  console.log('✅ Users seeded successfully');
};

const seedSurfaces = async () => {
  console.log('🌱 Seeding product surfaces...');
  
  const surfaces = [
    {
      name: 'Черточки',
      description: 'Поверхность с рисунком в виде черточек',
      isSystem: true
    },
    {
      name: 'Чешуйки',
      description: 'Поверхность с рисунком в виде чешуек',
      isSystem: true
    },
    {
      name: 'Гладкая',
      description: 'Гладкая поверхность без рисунка',
      isSystem: true
    },
    {
      name: '1 коровка',
      description: 'Поверхность с одним логотипом коровки',
      isSystem: true
    },
    {
      name: '3 коровки',
      description: 'Поверхность с тремя логотипами коровок',
      isSystem: true
    },
    {
      name: 'Чешуйка с лого',
      description: 'Поверхность с чешуйками и логотипом',
      isSystem: true
    }
  ];

  await db.insert(schema.productSurfaces).values(surfaces).onConflictDoNothing();
  console.log('✅ Product surfaces seeded successfully');
};

const seedLogos = async () => {
  console.log('🌱 Seeding product logos...');
  
  const logos = [
    {
      name: 'GEA',
      description: 'Логотип бренда GEA',
      isSystem: true
    },
    {
      name: 'Maximilk',
      description: 'Логотип бренда Maximilk',
      isSystem: true
    },
    {
      name: 'VELES',
      description: 'Логотип бренда VELES',
      isSystem: true
    },
    {
      name: 'Агротек',
      description: 'Логотип бренда Агротек',
      isSystem: true
    },
    {
      name: 'Арнтьен',
      description: 'Логотип бренда Арнтьен',
      isSystem: true
    }
  ];

  await db.insert(schema.productLogos).values(logos).onConflictDoNothing();
  console.log('✅ Product logos seeded successfully');
};

const seedMaterials = async () => {
  console.log('🌱 Seeding product materials...');
  
  const materials = [
    {
      name: 'Протектор',
      description: 'Материал протектор для резиновых изделий',
      isSystem: true
    },
    {
      name: 'Дробленка',
      description: 'Материал дробленка для резиновых изделий',
      isSystem: true
    }
  ];

  await db.insert(schema.productMaterials).values(materials).onConflictDoNothing();
  console.log('✅ Product materials seeded successfully');
};

const seedCategories = async () => {
  console.log('🌱 Seeding categories...');

  const categories = [
    { id: 1, name: 'Лежаки резиновые', parentId: null, path: '1' },
    { id: 2, name: 'Чешские (0 Чеш)', parentId: 1, path: '1.2' },
    { id: 3, name: '3-Корончатые (3Кор)', parentId: 1, path: '1.3' },
    { id: 4, name: 'Брендовые', parentId: 1, path: '1.4' },
    { id: 5, name: 'GEA', parentId: 4, path: '1.4.5' },
    { id: 6, name: 'Agrotek', parentId: 4, path: '1.4.6' },
    { id: 7, name: 'Верблюд', parentId: 4, path: '1.4.7' },
    { id: 8, name: 'Коврики', parentId: null, path: '8' },
    { id: 9, name: 'Кольцевые', parentId: 8, path: '8.9' },
    { id: 10, name: 'Придверные', parentId: 8, path: '8.10' },
    { id: 11, name: 'Рулонные покрытия', parentId: null, path: '11' },
    { id: 12, name: 'Крепежные изделия', parentId: null, path: '12' },
    { id: 13, name: 'Дюбели', parentId: 12, path: '12.13' }
  ];

  for (const category of categories) {
    await db.insert(schema.categories).values(category).onConflictDoNothing();
  }

  console.log('✅ Categories seeded successfully');
};

const seedProducts = async () => {
  console.log('🌱 Seeding products...');

  const products = [
    {
      name: 'Лежак 0 Чеш 1800×1200×30',
      article: 'LCH-1800-1200-30',
      categoryId: 2,
      dimensions: { length: 1800, width: 1200, height: 30 },
      characteristics: { surface: 'чертёная', material: 'резина', type: 'стандартный' },
      tags: ['стандарт', 'чешский', '1800×1200', '30мм', 'чертёный'],
      price: '15430.00',
      costPrice: '12450.00',
      normStock: 100,
      notes: 'Популярный размер, высокий спрос летом. Производство 2-3 дня.'
    },
    {
      name: 'Лежак 0 Чеш 1800×1200×35',
      article: 'LCH-1800-1200-35',
      categoryId: 2,
      dimensions: { length: 1800, width: 1200, height: 35 },
      characteristics: { surface: 'чертёная', material: 'резина', type: 'стандартный' },
      tags: ['стандарт', 'чешский', '1800×1200', '35мм', 'чертёный'],
      price: '16780.00',
      costPrice: '13560.00',
      normStock: 50
    },
    {
      name: 'Лежак GEA 1800×1200×30',
      article: 'GEA-1800-1200-30',
      categoryId: 5,
      dimensions: { length: 1800, width: 1200, height: 30 },
      characteristics: { surface: 'брендовая', material: 'резина', brand: 'GEA' },
      tags: ['GEA', 'брендовый', '1800×1200', '30мм'],
      price: '18920.00',
      costPrice: '15340.00',
      normStock: 30
    },
    {
      name: 'Коврик кольцевой 600×400',
      article: 'KK-600-400',
      categoryId: 9,
      dimensions: { length: 600, width: 400, height: 15 },
      characteristics: { surface: 'кольцевая', material: 'резина', type: 'без отверстий' },
      tags: ['коврик', 'кольцевой', '600×400'],
      price: '2850.00',
      costPrice: '2280.00',
      normStock: 200
    },
    {
      name: 'Дюбель 10×100мм',
      article: 'DUB-10-100',
      categoryId: 13,
      dimensions: { diameter: 10, length: 100 },
      characteristics: { material: 'пластик', type: 'универсальный' },
      tags: ['дюбель', 'крепеж', '10×100'],
      price: '12.50',
      costPrice: '8.90',
      normStock: 5000
    }
  ];

  for (const product of products) {
    const [newProduct] = await db.insert(schema.products).values(product).returning().onConflictDoNothing();
    
    if (newProduct) {
      // Create stock record
      await db.insert(schema.stock).values({
        productId: newProduct.id,
        currentStock: Math.floor(Math.random() * 200) + 50, // Random stock 50-250
        reservedStock: Math.floor(Math.random() * 20) // Random reserved 0-20
      }).onConflictDoNothing();
    }
  }

  console.log('✅ Products seeded successfully');
};

const main = async () => {
  try {
    console.log('🚀 Starting database seeding...');
    
    await seedUsers();
    await seedSurfaces();
    await seedLogos();
    await seedMaterials();
    await seedCategories(); 
    await seedProducts();
    
    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('🔑 Test users created:');
    console.log('  director/123456  - Директор по продажам');
    console.log('  manager1/123456  - Менеджер по продажам');
    console.log('  production1/123456 - Сотрудник производства');
    console.log('  warehouse1/123456  - Сотрудник склада');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

main(); 