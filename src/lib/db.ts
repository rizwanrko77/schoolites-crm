import { neon, Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// Serverless HTTP client for ultra-fast individual queries
export const sql = neon(process.env.DATABASE_URL);

// Serverless Pool for transactions and complex queries
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
