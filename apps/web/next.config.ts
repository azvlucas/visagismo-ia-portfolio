import type { NextConfig } from 'next';

/**
 * Destino do rewrite /api/v1/* → API.
 * Em Docker/Coolify o build DEVE usar http://api:3001 (hostname do serviço),
 * não a URL pública (hairpin) nem localhost (é o próprio container web).
 */
const apiUrl = (
  process.env.API_INTERNAL_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/$/, '');

const nextConfig: NextConfig = {
  // standalone needs symlink privileges on Windows (Developer Mode).
  // Enable in Docker/Coolify via DOCKER_BUILD=1.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@visagismo/shared'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
