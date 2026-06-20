'use client';

import { useState } from 'react';
import { Play, ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from 'lucide-react';

export interface TryItPanelProps {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  pathParams?: string[];
  defaultBody?: string;
}

const DEFAULT_API_KEY = 'sots_dev_key_12345';
const DEFAULT_GATEWAY_URL = 'http://localhost:3000';

export function TryItPanel({ method, path, pathParams = [], defaultBody = '' }: TryItPanelProps) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [body, setBody] = useState(defaultBody);
  const [paramValues, setParamValues] = useState<Record<string, string>>(
    Object.fromEntries(pathParams.map((p) => [p, '']))
  );

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    data: unknown;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedPath = pathParams.reduce(
    (p, param) => p.replace(`{${param}}`, encodeURIComponent(paramValues[param] || `{${param}}`)),
    path
  );

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    setError(null);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
      };
      if (hasBody && body.trim()) {
        headers['Content-Type'] = 'application/json';
      }

      const gatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || DEFAULT_GATEWAY_URL;
      const res = await fetch(`${gatewayUrl}${resolvedPath}`, {
        method,
        headers,
        body: hasBody && body.trim() ? body : undefined,
      });

      let data: unknown;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      setResponse({ status: res.status, data });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = response && response.status >= 200 && response.status < 300;

  return (
    <div className="my-6 rounded-lg border border-border overflow-hidden bg-muted/30 backdrop-blur-sm transition-colors duration-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-muted/60 hover:bg-accent/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Play className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-foreground">Try it out</span>
          <span className="hidden sm:inline text-[11px] font-mono text-muted-foreground truncate">{resolvedPath}</span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="p-5 space-y-5 border-t border-border bg-background/40">
          {/* Authorization Header */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Authentication</p>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground/60 font-mono">Authorization (Bearer Token)</label>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors placeholder:text-muted-foreground/30"
                placeholder="API Key"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Path Params */}
          {pathParams.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Path Parameters</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pathParams.map((param) => (
                  <div key={param} className="space-y-1">
                    <label className="text-[10px] text-muted-foreground/60 font-mono">{param}</label>
                    <input
                      value={paramValues[param]}
                      onChange={(e) =>
                        setParamValues((prev) => ({ ...prev, [param]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors placeholder:text-muted-foreground/30"
                      placeholder={`Enter ${param}`}
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body */}
          {hasBody && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Request Body (JSON)</p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={Math.min(15, Math.max(5, (body.match(/\n/g) || []).length + 2))}
                className="w-full px-3 py-3 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-y transition-colors leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}

          {/* Send Action */}
          <button
            onClick={handleSend}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-lg shadow-blue-500/10"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {loading ? 'Sending…' : 'Send Request'}
          </button>

          {/* Response / Errors */}
          {(response || error) && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                {isSuccess ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                )}
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Response</p>
                {response && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      isSuccess
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {response.status}
                  </span>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-rose-950/20 border border-rose-900/30 px-4 py-3 text-rose-400 text-xs font-mono">
                  {error}
                </div>
              )}

              {response && (
                <pre className="rounded-lg bg-background border border-border px-4 py-4 text-[11px] text-muted-foreground font-mono overflow-x-auto max-h-96 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all shadow-inner">
                  {typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
