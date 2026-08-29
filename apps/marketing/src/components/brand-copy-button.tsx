"use client";

import { useState } from "react";

export function BrandCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="brand-copy" onClick={copyValue} aria-live="polite">
      {copied ? `Copied ${value}` : "Copy HEX"}
    </button>
  );
}
