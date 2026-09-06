import rawNavigation from './docs-navigation.json';
import type { DocPageMeta, DocsNavGroup } from '@/lib/docs-types';

export const docsNavigation = rawNavigation.groups as DocsNavGroup[];
export const standalonePages = rawNavigation.standalone as DocPageMeta[];
export const externalDocsLinks = rawNavigation.external;

export const navigationPages = [
  ...docsNavigation.flatMap((group) => group.sections.flatMap((section) => section.pages)),
  ...standalonePages,
];

export const navigationPageById = new Map(navigationPages.map((page) => [page.id, page]));
export const navigationPageBySlug = new Map(navigationPages.map((page) => [page.slug, page]));

export function getSectionForPage(pageId: string) {
  for (const group of docsNavigation) {
    const section = group.sections.find((candidate) =>
      candidate.pages.some((page) => page.id === pageId),
    );
    if (section) return { group, section };
  }
  return null;
}
