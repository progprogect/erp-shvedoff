import type { Config } from 'drizzle-kit';

// Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv/config');
}

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production'
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'mikitavalkunovich',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'erp_shvedoff',
        ssl: process.env.NODE_ENV === 'production'
      }
} satisfies Config; 