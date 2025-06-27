const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'mikitavalkunovich',
  password: '',
  database: 'erp_shvedoff'
});

async function createTestUsers() {
  try {
    console.log('🌱 Creating test users...');
    
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const users = [
      { username: 'director', role: 'director', fullName: 'Директор по продажам' },
      { username: 'manager1', role: 'manager', fullName: 'Менеджер 1' },
      { username: 'manager2', role: 'manager', fullName: 'Менеджер 2' },
      { username: 'production1', role: 'production', fullName: 'Сотрудник производства 1' },
      { username: 'warehouse1', role: 'warehouse', fullName: 'Сотрудник склада 1' }
    ];
    
    for (const user of users) {
      await pool.query(
        `INSERT INTO users (username, password_hash, role, full_name, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())
         ON CONFLICT (username) DO NOTHING`,
        [user.username, hashedPassword, user.role, user.fullName]
      );
      console.log(`✅ Created user: ${user.username} (${user.role})`);
    }
    
    console.log('✨ Test users created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await pool.end();
  }
}

createTestUsers(); 