import { readServerEnvironment } from '@trip-planner/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createClient } from 'redis';

import * as schema from './schema';

let pool: Pool | undefined;
let redis: ReturnType<typeof createClient> | undefined;

export function getPostgresPool(): Pool {
  pool ??= new Pool({ connectionString: readServerEnvironment().DATABASE_URL });
  return pool;
}

export function getDatabase() {
  return drizzle(getPostgresPool(), { schema });
}

export async function getRedisClient(): Promise<
  ReturnType<typeof createClient>
> {
  redis ??= createClient({ url: readServerEnvironment().REDIS_URL });

  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
}

export * from './repository';
export * from './category-repository';
export * from './auth-repository';
export * from './schema';
