import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'drizzle-kit';

const workspaceEnvironment = fileURLToPath(
  new URL('../../.env', import.meta.url),
);
if (existsSync(workspaceEnvironment)) loadEnvFile(workspaceEnvironment);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run database migrations');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
