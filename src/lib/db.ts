import { neon, Pool, type NeonQueryFunction } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

let envLoaded = false;

function ensureEnvLoaded() {
  if (process.env.DATABASE_URL || envLoaded) return;
  envLoaded = true;
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config();
}

function requireDatabaseUrl(): string {
  ensureEnvLoaded();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }
  return url;
}

let sqlClient: NeonQueryFunction<false, false> | undefined;
let poolClient: Pool | undefined;

function getSql(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    sqlClient = neon(requireDatabaseUrl());
  }
  return sqlClient;
}

function getPool(): Pool {
  if (!poolClient) {
    poolClient = new Pool({ connectionString: requireDatabaseUrl() });
  }
  return poolClient;
}

/**
 * Created on first query so `next build` can import API routes
 * before Vercel has injected DATABASE_URL into the build environment.
 */
export const sql: NeonQueryFunction<false, false> = new Proxy((() => {}) as unknown as NeonQueryFunction<false, false>, {
  apply(_target, thisArg, args) {
    return Reflect.apply(getSql(), thisArg, args);
  },
  get(_target, prop, receiver) {
    const client = getSql();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const client = getPool();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
