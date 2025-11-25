/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable font optimization to avoid network calls during build
  optimizeFonts: false,
  
  // Enable experimental features if needed
  experimental: {
    // Add any experimental features here
  },
  
  // API routes rewrite for development and production
  async rewrites() {
    // Use environment variable to determine backend URL
    let backendUrl;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: Use BACKEND_URL env var or default to localhost:4001
      backendUrl = process.env.BACKEND_URL || 'http://localhost:4001';
      console.log(`[Next.js] Rewriting API requests to: ${backendUrl}`);
    } else if (process.env.DOCKER_ENV) {
      // Docker development: Use container name
      backendUrl = 'http://backend-dev:3001';
    } else {
      // Local development
      backendUrl = 'http://localhost:3001';
    }
      
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  
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