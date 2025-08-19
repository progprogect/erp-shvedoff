#!/usr/bin/env node

const { Pool } = require('pg');

// Используем внешний DATABASE_URL для Railway
const DATABASE_URL = 'postgresql://postgres:xeIitZntkaAAeoZSFpsOsfCOKpoORwGA@postgres.railway.internal:5432/railway';

async function fixMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
    max: 5
  });

  try {
    console.log('🔧 Подключаемся к production БД...');
    const client = await pool.connect();
    
    console.log('🔍 Проверяем текущее состояние БД...');
    
    // Проверяем таблицу products
    const checkTable = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'products' AND table_schema = 'public'
    `);
    console.log(`📊 Таблица products: ${checkTable.rows.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    
    // Проверяем колонку border_type
    const checkColumn = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'border_type'
    `);
    console.log(`📊 Поле border_type: ${checkColumn.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    
    // Проверяем enum border_type
    const checkEnum = await client.query(`
      SELECT typname FROM pg_type WHERE typname = 'border_type'
    `);
    console.log(`📊 Enum border_type: ${checkEnum.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    
    if (checkColumn.rows.length === 0) {
      console.log('🚨 Поле border_type отсутствует! Выполняю миграцию...');
      
      try {
        await client.query('BEGIN');
        
        // Создаем enum если не существует
        if (checkEnum.rows.length === 0) {
          console.log('   📝 Создаю enum border_type...');
          await client.query(`CREATE TYPE border_type AS ENUM ('with_border', 'without_border')`);
          console.log('   ✅ Enum создан');
        } else {
          console.log('   ✅ Enum уже существует');
        }
        
        // Добавляем колонку
        console.log('   📝 Добавляю поле border_type...');
        await client.query(`ALTER TABLE products ADD COLUMN border_type border_type`);
        console.log('   ✅ Поле добавлено');
        
        // Добавляем комментарий
        console.log('   📝 Добавляю комментарий...');
        await client.query(`COMMENT ON COLUMN products.border_type IS 'Наличие борта: with_border (с бортом) или without_border (без борта)'`);
        console.log('   ✅ Комментарий добавлен');
        
        // Создаем индекс
        console.log('   📝 Создаю индекс...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_border_type ON products(border_type)`);
        console.log('   ✅ Индекс создан');
        
        await client.query('COMMIT');
        console.log('🎉 Миграция border_type выполнена успешно!');
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка выполнения миграции:', error.message);
        throw error;
      }
    } else {
      console.log('✅ Поле border_type уже существует');
    }
    
    // Финальная проверка
    console.log('\n🔍 Финальная проверка...');
    const finalCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'border_type'
    `);
    
    if (finalCheck.rows.length > 0) {
      console.log('✅ Поле border_type найдено:', finalCheck.rows[0]);
    } else {
      console.log('❌ Поле border_type все еще отсутствует!');
    }
    
    // Проверяем количество товаров
    const countProducts = await client.query('SELECT COUNT(*) FROM products');
    console.log(`📊 Количество товаров в БД: ${countProducts.rows[0].count}`);
    
    client.release();
    console.log('\n🎯 ГОТОВО! Можете проверить каталог товаров.');
    
  } catch (error) {
    console.error('💥 Критическая ошибка:', error.message);
    console.error('Стек:', error.stack);
  } finally {
    await pool.end();
  }
}

fixMigration();