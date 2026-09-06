import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import legacyUrlMap from './src/config/legacy-url-map.json';

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm', 'remark-frontmatter', 'remark-mdx-frontmatter'],
    rehypePlugins: [
      'rehype-slug',
      ['rehype-autolink-headings', { behavior: 'wrap' }],
      ['rehype-pretty-code', { theme: 'github-dark-default', keepBackground: false }],
    ],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  async redirects() {
    const marketingOrigin = (process.env.NEXT_PUBLIC_MARKETING_URL || 'https://tellann.co').replace(/\/$/, '');
    return legacyUrlMap
      .filter((entry) => entry.source !== entry.destination)
      .map((entry) => ({
        source: entry.source,
        destination: entry.external ? marketingOrigin + entry.destination : entry.destination,
        permanent: true,
      }));
  },
};

export default withMDX(nextConfig);
