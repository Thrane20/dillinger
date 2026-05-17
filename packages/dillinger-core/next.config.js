/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',

  // Anchor Turbopack's workspace root to the monorepo root so it doesn't
  // incorrectly infer the root as packages/dillinger-core/app/.
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },

  logging: {
    incomingRequests: {
      ignore: [
        /\/api\/streaming\/(test|graph|status)/,
        /\/api\/games\/active-containers\/logs/,
        /\/api\/online-sources\/gog\/downloads/,
      ],
    },
  },

  // Mark packages with native bindings as external for the server bundle
  serverExternalPackages: ['dockerode', 'ssh2', 'cpu-features', 'winston', 'winston-daily-rotate-file'],
  
  // Note: API routes are now handled directly by Next.js App Router
  // No rewrites needed - /api/* routes are served from app/api/*
  
  // CORS and headers configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;