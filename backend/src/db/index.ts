import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Database configuration with improved Railway support
const getDatabaseConfig = () => {
  console.log('🔧 DB Config Debug:');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
  console.log('   DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) || 'N/A');
  
  if (process.env.DATABASE_URL) {
    console.log('🔗 Using DATABASE_URL for connection');
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 60000,  // Увеличили до 60 секунд
      idleTimeoutMillis: 60000,
      max: 10,  // Уменьшили пул соединений
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 60000
    };
    console.log('   SSL enabled:', !!config.ssl);
    return config;
  }
  
  console.log('🔗 Using individual DB variables for connection');
  console.log('   DB_HOST:', process.env.DB_HOST || 'localhost');
  console.log('   DB_PORT:', process.env.DB_PORT || '5432');
  console.log('   DB_USER:', process.env.DB_USER || 'mikitavalkunovich');
  console.log('   DB_NAME:', process.env.DB_NAME || 'erp_shvedoff');
  
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'mikitavalkunovich',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'erp_shvedoff',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 20
  };
};

const pool = new Pool(getDatabaseConfig());

export const db = drizzle(pool, { schema });

// Test connection with improved error handling
export const testConnection = async () => {
  try {
    console.log('🔄 Testing database connection...');
    console.log('🔧 Environment:', process.env.NODE_ENV);
    console.log('🔧 DATABASE_URL present:', !!process.env.DATABASE_URL);
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    console.log('✅ Database connection successful');
    console.log('⏰ Current database time:', result.rows[0].current_time);
    return true;
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error('   Error code:', error?.code || 'Unknown');
    console.error('   Error message:', error?.message || error);
    
    if (error?.code === 'ETIMEDOUT') {
      console.error('   💡 Suggestion: Check if PostgreSQL addon is properly connected to Railway');
      console.error('   💡 Suggestion: Verify DATABASE_URL variable is set correctly');
    }
    
    if (error?.code === 'ENOTFOUND') {
      console.error('   💡 Suggestion: Database host not found, check connection string');
    }
    
    console.error('   📋 All env vars count:', Object.keys(process.env).length);
    console.error('   📋 DB-related env vars:', Object.keys(process.env).filter(k => k.includes('DB') || k.includes('DATABASE')));
    console.error('   📋 Railway env vars:', Object.keys(process.env).filter(k => k.includes('RAILWAY')));
    console.error('   📋 Important env vars present:');
    console.error('      - NODE_ENV:', !!process.env.NODE_ENV);
    console.error('      - DATABASE_URL:', !!process.env.DATABASE_URL);
    console.error('      - JWT_SECRET:', !!process.env.JWT_SECRET);
    console.error('      - CORS_ORIGINS:', !!process.env.CORS_ORIGINS);
    
    return false;
  }
};

export { schema }; 