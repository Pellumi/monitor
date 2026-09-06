import type { MetadataRoute } from 'next';
import { docsManifest } from '@/generated/docs-manifest';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.tellann.co').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...docsManifest.map((doc) => ({
      url: siteUrl + '/' + doc.slug,
      lastModified: new Date(doc.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: doc.status === 'planned' ? 0.5 : 0.8,
    })),
  ];
}
