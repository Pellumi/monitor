import type { NextConfig } from 'next';
import movedToDocs from './src/config/docs-redirects.json';
import retiredRoutes from './src/config/retired-redirects.json';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';
const docsUrl = (process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com').replace(/\/$/, '');

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/docs', destination: docsUrl, permanent: false },
      { source: '/login', destination: `${appUrl}/auth/login`, permanent: false },
      { source: '/signup', destination: `${appUrl}/auth/login`, permanent: false },
      // Routes whose content belongs to the documentation site. Permanent, so
      // any link or bookmark to the old marketing URL consolidates on docs.
      ...movedToDocs.map(({ source, destination }) => ({
        source,
        destination: destination === '/' ? docsUrl : `${docsUrl}${destination}`,
        permanent: true,
      })),
      // Marketing routes retired before they were built. Temporary, so a route
      // can come back as a real page without fighting cached permanent redirects.
      ...retiredRoutes.map(({ source, destination }) => ({ source, destination, permanent: false })),
    ];
  },
};

export default nextConfig;
