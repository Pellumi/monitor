export type DocsVersion = 'v1';
export type DocStatus = 'ga' | 'beta' | 'preview' | 'planned';
export type DocAudience = 'developer' | 'qa' | 'engineering-manager' | 'product' | 'admin';
export type DocPlan = 'free' | 'local' | 'solo' | 'team' | 'business' | 'enterprise';

export interface DocPageMeta {
  id: string;
  slug: string;
  title: string;
  description: string;
  version: DocsVersion;
  status: DocStatus;
  audiences: DocAudience[];
  plans?: DocPlan[];
  tags: string[];
  related: string[];
  updatedAt: string;
}

export interface DocsNavGroup {
  id: 'start' | 'understand' | 'build' | 'operate' | 'resources';
  title: string;
  sections: DocsNavSection[];
}

export interface DocsNavSection {
  id: string;
  title: string;
  pages: DocPageMeta[];
}

export interface SearchDocument {
  id: string;
  slug: string;
  title: string;
  description: string;
  headings: string[];
  body: string;
  codeTerms: string[];
  endpointTerms: string[];
  tags: string[];
}

export interface GeneratedDoc extends DocPageMeta {
  headings: Array<{ id: string; title: string; level: 2 | 3 }>;
  sectionId: string;
  sectionTitle: string;
  groupId: DocsNavGroup['id'] | 'resources';
  sourcePath: string;
}
