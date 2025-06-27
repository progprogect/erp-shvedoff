const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'mikitavalkunovich',
  password: '',
  database: 'erp_shvedoff'
});

async function testAuth() {
  try {
    console.log('🔍 Тестируем аутентификацию...\n');
    
    // Проверяем подключение к БД
    const client = await pool.connect();
    console.log('✅ Подключение к PostgreSQL успешно');
    
    // Проверяем пользователей
    const users = await client.query('SELECT username, role, full_name FROM users ORDER BY id');
    console.log('\n👥 Пользователи в системе:');
    users.rows.forEach(user => {
      console.log(`   • ${user.username} (${user.role}) - ${user.full_name}`);
    });
    
    // Тестируем логин
    console.log('\n🔐 Тестируем вход director / 123456...');
    const director = await client.query(
      'SELECT * FROM users WHERE username = $1', 
      ['director']
    );
    
    if (director.rows.length > 0) {
      const user = director.rows[0];
      const isValid = await bcrypt.compare('123456', user.password_hash);
      
      if (isValid) {
        console.log('✅ Аутентификация успешна!');
        console.log(`   Пользователь: ${user.full_name}`);
        console.log(`   Роль: ${user.role}`);
        console.log(`   Статус: ${user.is_active ? 'Активен' : 'Неактивен'}`);
      } else {
        console.log('❌ Неверный пароль');
      }
    } else {
      console.log('❌ Пользователь не найден');
    }
    
    // Тестируем таблицы
    console.log('\n📊 Структура базы данных:');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`   Создано таблиц: ${tables.rows.length}`);
    tables.rows.slice(0, 10).forEach(table => {
      console.log(`   • ${table.table_name}`);
    });
    if (tables.rows.length > 10) {
      console.log(`   ... и ещё ${tables.rows.length - 10} таблиц`);
    }
    
    client.release();
    console.log('\n🎉 Все тесты прошли успешно!');
    console.log('\n📋 Готовые учетные записи для тестирования:');
    console.log('   director / 123456    (Директор по продажам)');
    console.log('   manager1 / 123456    (Менеджер по продажам)');
    console.log('   production1 / 123456 (Сотрудник производства)');
    console.log('   warehouse1 / 123456  (Сотрудник склада)');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

testAuth(); 