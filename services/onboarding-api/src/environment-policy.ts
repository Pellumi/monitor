import { EnvironmentType } from '@tellann/db';

export function normalizeEnvironmentBaseUrl(value: unknown, type: EnvironmentType): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    throw new Error('Base URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Base URL must use HTTP or HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Base URL cannot contain embedded credentials.');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('Base URL cannot contain a query string or fragment.');
  }
  if (type === EnvironmentType.PRODUCTION && parsed.protocol !== 'https:') {
    throw new Error('Production environments require an HTTPS base URL.');
  }

  const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${pathname}`;
}

export function normalizeEnvironmentName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new Error('Environment name is required.');
  if (name.length > 80) throw new Error('Environment name must be 80 characters or fewer.');
  return name;
}
