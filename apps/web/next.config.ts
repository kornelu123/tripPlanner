import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@trip-planner/config',
    '@trip-planner/database',
    '@trip-planner/domain',
  ],
};

export default nextConfig;
