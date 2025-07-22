import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Database configuration with improved Railway support
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('🔗 Using DATABASE_URL for connection');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 20
    };
  }
  
  console.log('🔗 Using individual DB variables for connection');
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
    
    console.error('   📋 Available env vars:', Object.keys(process.env).filter(k => k.includes('DB')));
    
    return false;
  }
};

export { schema }; 