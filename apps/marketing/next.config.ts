import type { NextConfig } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';
const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/docs', destination: docsUrl, permanent: false },
      { source: '/login', destination: `${appUrl}/auth/login`, permanent: false },
      { source: '/signup', destination: `${appUrl}/auth/login`, permanent: false },
    ];
  },
};

export default nextConfig;
