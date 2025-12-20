module.exports = {
  apps: [
    {
      name: 'dillinger-backend',
      cwd: '/app/packages/dillinger-core/backend',
      script: 'node',
      args: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.BACKEND_PORT || '3011',
        DILLINGER_ROOT: process.env.DILLINGER_ROOT || '/data',
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3010',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'dillinger-frontend',
      cwd: '/app/packages/dillinger-core/frontend',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3010',
        NEXT_PUBLIC_API_URL: process.env.FRONTEND_URL || 'http://localhost:3010',
        BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || '3011'}`,
        DOCKER_CONTAINER: process.env.DOCKER_CONTAINER,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
