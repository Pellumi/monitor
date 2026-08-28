import type { MetadataRoute } from 'next';
import { sitemapRoutes } from '@/config/site-routes';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://domain-name.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.split('/').length === 2 ? 0.8 : 0.7,
  }));
}
