#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Настройки подключения к БД
const getDatabaseConfig = () => {
  console.log('🔧 Migration DB Config:');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   DATABASE_URL present:', !!process.env.DATABASE_URL);
  
  if (process.env.DATABASE_URL) {
    console.log('🔗 Using DATABASE_URL for migration connection');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 60000,
      idleTimeoutMillis: 60000,
      max: 5
    };
  }
  
  console.log('🔗 Using individual DB variables for migration connection');
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'mikitavalkunovich',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'erp_shvedoff',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 5
  };
};

// Миграции для выполнения
const migrations = [
  {
    name: 'add_order_source',
    file: 'migrations/add_order_source.sql',
    checkQuery: `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'source'
    `,
    description: 'Добавление полей source и custom_source в таблицу orders'
  },
  {
    name: 'add_border_type_field',
    file: 'migrations/add_border_type_field.sql',
    checkQuery: `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'border_type'
    `,
    description: 'Добавление поля border_type в таблицу products'
  },
  {
    name: 'create_permissions_and_assignments',
    file: 'migrations/create_permissions_and_assignments.sql',
    checkQuery: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'permissions' AND table_schema = 'public'
    `,
    description: 'Создание системы разрешений (permissions, role_permissions, user_permissions)'
  }
];

async function runMigrations() {
  let pool;
  
  try {
    console.log('🚀 === АВТОМАТИЧЕСКИЕ МИГРАЦИИ PRODUCTION БД ===');
    console.log('');
    
    // Подключение к БД
    pool = new Pool(getDatabaseConfig());
    const client = await pool.connect();
    
    console.log('✅ Подключение к БД установлено');
    console.log('');
    
    // Проверяем и выполняем каждую миграцию
    let migrationsExecuted = 0;
    
    for (const migration of migrations) {
      console.log(`🔍 Проверяю миграцию: ${migration.name}`);
      console.log(`   📋 ${migration.description}`);
      
      try {
        // Проверяем, нужна ли миграция
        const checkResult = await client.query(migration.checkQuery);
        const needsMigration = checkResult.rows.length === 0;
        
        if (!needsMigration) {
          console.log(`   ✅ Миграция уже выполнена, пропускаю`);
          console.log('');
          continue;
        }
        
        console.log(`   🔄 Выполняю миграцию...`);
        
        // Читаем файл миграции
        const migrationPath = path.join(__dirname, '..', migration.file);
        
        if (!fs.existsSync(migrationPath)) {
          console.log(`   ⚠️ Файл миграции не найден: ${migration.file}`);
          console.log('');
          continue;
        }
        
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Выполняем миграцию
        await client.query('BEGIN');
        
        // Разбиваем SQL на команды (по точке с запятой)
        const commands = migrationSQL
          .split(';')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
        
        for (const command of commands) {
          if (command.trim()) {
            await client.query(command);
          }
        }
        
        await client.query('COMMIT');
        
        console.log(`   ✅ Миграция ${migration.name} выполнена успешно`);
        migrationsExecuted++;
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.log(`   ❌ Ошибка выполнения миграции ${migration.name}:`);
        console.log(`      ${error.message}`);
        
        // Для production продолжаем работу даже при ошибке миграции
        if (process.env.NODE_ENV === 'production') {
          console.log(`   ⚠️ Production режим: продолжаю работу несмотря на ошибку`);
        } else {
          throw error;
        }
      }
      
      console.log('');
    }
    
    client.release();
    
    console.log('🎉 === МИГРАЦИИ ЗАВЕРШЕНЫ ===');
    console.log(`📊 Выполнено миграций: ${migrationsExecuted}/${migrations.length}`);
    console.log('✅ База данных готова к работе');
    console.log('');
    
  } catch (error) {
    console.error('❌ Критическая ошибка миграций:');
    console.error('   ', error.message);
    
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Production режим: продолжаю запуск сервера');
      console.log('💡 Рекомендуется проверить миграции вручную');
    } else {
      process.exit(1);
    }
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Запускаем миграции
runMigrations();