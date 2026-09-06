import { getPostgresPool, getRedisClient } from '@trip-planner/database';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = await Promise.allSettled([
    Promise.resolve().then(() => getPostgresPool().query('SELECT 1')),
    Promise.resolve()
      .then(() => getRedisClient())
      .then((client) => client.ping()),
  ]);
  const services = {
    postgres: checks[0].status === 'fulfilled' ? 'up' : 'down',
    redis: checks[1].status === 'fulfilled' ? 'up' : 'down',
  } as const;
  const healthy = Object.values(services).every((status) => status === 'up');

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', services },
    { status: healthy ? 200 : 503 },
  );
}
