'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key, Copy, Check, Terminal, ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const ONBOARDING_API = '/api-gateway';

interface ApiKeyResponse {
  id: string;
  keyPrefix: string;
  label: string | null;
  createdAt: string;
  rawKey: string;
  environmentId: string;
}

import { Suspense } from 'react';

function ApiKeysContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId') ?? '';
  const appId = searchParams.get('appId') ?? '';
  const appName = searchParams.get('appName') ?? '';

  const [apiKey, setApiKey] = useState<ApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      // 1. Fetch environments
      const envsRes = await fetch(`${ONBOARDING_API}/applications/${appId}/environments`);
      if (!envsRes.ok) throw new Error('Failed to fetch environments');
      const envs = await envsRes.json();
      const devEnv = envs.find((e: any) => e.name === 'Development') || envs[0];
      if (!devEnv) throw new Error('No environment found for this application');

      // 2. Generate API Key scoped to this environment
      const res = await fetch(`${ONBOARDING_API}/environments/${devEnv.id}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: `Key for ${appName} (Development)` }),
      });
      if (!res.ok) throw new Error('Failed to generate API key');
      const key = await res.json();
      return { ...key, environmentId: devEnv.id } as ApiKeyResponse;
    },
    onSuccess: (data) => {
      setApiKey(data);
    },
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sdkCode = `const { SOTS } = require('@sots/backend-sdk');

async function verifySotsInstall() {
  SOTS.initialize({
    endpoint: 'http://localhost:3000',
    apiKey: '${apiKey?.rawKey ?? 'YOUR_API_KEY'}',
    applicationId: '${appId}',
    environmentId: '${apiKey?.environmentId ?? 'YOUR_ENVIRONMENT_ID'}'
  });

  await SOTS.verifyInstallation();
}

verifySotsInstall().catch(console.error);`;

  if (!orgId || !appId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-red-400">Error: Context missing. Please restart onboarding.</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          {/* <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Key className="h-6 w-6" />
          </div> */}
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Generate API Key</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Create authentication credentials for <span className="font-semibold text-neutral-300">{appName}</span>
          </p>
        </div>

        {!apiKey ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <p className="text-center text-sm text-neutral-400 max-w-md">
              To connect your application to SOTS, you need an API key. This key will authorize telemetry events sent from the SDK.
            </p>
            <button
              onClick={() => generateKeyMutation.mutate()}
              disabled={generateKeyMutation.isPending}
              className="flex items-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-colors"
            >
              <span>{generateKeyMutation.isPending ? 'Generating…' : 'Generate API Key'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Warning card */}
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start space-x-3 text-yellow-400">
              {/* <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" /> */}
              <div className="text-sm">
                <span className="font-semibold">Store this key safely!</span> It will not be shown again. If you lose it, you will need to generate a new key.
              </div>
            </div>

            {/* API Key box */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 flex items-center justify-between">
              <code className="text-sm font-mono text-white select-all overflow-x-auto max-w-[80%] pr-2 no-scrollbar">
                {apiKey.rawKey}
              </code>
              <button
                onClick={() => copyToClipboard(apiKey.rawKey)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            {/* SDK setup */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-300 flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-blue-400" />
                <span>SDK Integration Snippet</span>
              </h3>
              <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <pre className="text-xs font-mono text-neutral-300 overflow-x-auto select-all whitespace-pre">
                  {sdkCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(sdkCode)}
                  className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Go to dashboard */}
            <div className="pt-4 flex justify-end">
              <Link
                href={`/onboarding/declare?appId=${appId}`}
                className="flex items-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading…</div>}>
      <ApiKeysContent />
    </Suspense>
  );
}
