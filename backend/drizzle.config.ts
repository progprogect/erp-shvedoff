import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'mikitavalkunovich',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'erp_shvedoff',
    ssl: process.env.NODE_ENV === 'production'
  }
} satisfies Config; 