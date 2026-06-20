'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  ruby: 'Ruby',
  php: 'PHP',
  go: 'Go',
  rust: 'Rust',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  yaml: 'YAML',
  bash: 'Bash',
  shell: 'Shell',
  plaintext: 'Plain Text',
};

export function CodeBlock({ code, language = 'plaintext', title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLanguage = LANGUAGE_NAMES[language.toLowerCase()] || language;

  return (
    <div className="my-6 rounded-lg border border-border overflow-hidden bg-background shadow-sm transition-colors duration-200">
      <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {title && <span className="text-xs font-mono text-foreground font-medium">{title}</span>}
          <span className="text-[10px] font-mono text-muted-foreground bg-background border border-border px-2 py-0.5 rounded shadow-sm">
            {displayLanguage}
          </span>
        </div>
      </div>
      <div className="relative">
        <SyntaxHighlighter
          language={language.toLowerCase()}
          style={atomDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.8125rem',
            borderRadius: 0,
            backgroundColor: 'transparent',
          }}
          wrapLines={true}
          lineProps={{
            style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' },
          }}
        >
          {code}
        </SyntaxHighlighter>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-all border border-border"
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
