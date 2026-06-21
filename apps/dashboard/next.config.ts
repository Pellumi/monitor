import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiGatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || process.env.API_GATEWAY_INTERNAL_URL || 'http://localhost:3000';

    return [
      {
        source: '/api-gateway/:path*',
        destination: `${apiGatewayUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
