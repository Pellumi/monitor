import type { MetadataRoute } from 'next';
import { docs } from '@/lib/docs';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.domain-name.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...docs.map((doc) => ({
      url: `${siteUrl}/${doc.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
