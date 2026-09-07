import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const workspaceEnvironment = fileURLToPath(
  new URL('../../.env', import.meta.url),
);
if (existsSync(workspaceEnvironment)) loadEnvFile(workspaceEnvironment);

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: [
    '@trip-planner/config',
    '@trip-planner/database',
    '@trip-planner/domain',
  ],
};

export default nextConfig;
