'use client';

import { useServerInsertedHTML } from 'next/navigation';

export function JsonLd({ id, value }: { id: string; value: Record<string, unknown> }) {
  useServerInsertedHTML(() => (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, '\\u003c') }}
    />
  ));

  return null;
}
