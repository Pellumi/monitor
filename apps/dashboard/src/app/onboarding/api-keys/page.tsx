'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key, Copy, Check, Terminal, ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
      const envsRes = await authenticatedFetch(`${ONBOARDING_API}/applications/${appId}/environments`);
      if (!envsRes.ok) throw new Error('Failed to fetch environments');
      const envs = await envsRes.json();
      const devEnv = envs.find((e: any) => e.name === 'Development') || envs[0];
      if (!devEnv) throw new Error('No environment found for this application');

      // 2. Generate API Key scoped to this environment
      const res = await authenticatedFetch(`${ONBOARDING_API}/environments/${devEnv.id}/api-keys`, {
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
      <div className="w-full max-w-2xl space-y-8 rounded-md border border-[#262626] bg-[#131313] p-8 shadow-2xl">
        <div className="text-center">
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-white">Generate Ingestion Key</h2>
          <p className="mt-2 text-sm text-[#c4c7c8] leading-relaxed">
            Create authentication credentials for <span className="font-semibold text-white">{appName}</span>
          </p>
        </div>

        {!apiKey ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <p className="text-center text-sm text-[#c4c7c8] leading-relaxed max-w-md">
              To connect your application to Tellann, you need an ingestion key. This key will authorize telemetry events sent from the SDK.
            </p>
            <Button
              variant="primary"
              onClick={() => generateKeyMutation.mutate()}
              disabled={generateKeyMutation.isPending}
            >
              <span>{generateKeyMutation.isPending ? 'Generating…' : 'Generate Ingestion Key'}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Warning card */}
            <div className="rounded-md border border-[#444748] bg-black p-4 flex items-start space-x-3 text-[#e2e2e2] font-mono text-xs">
              <div>
                <span className="font-bold text-white uppercase tracking-wider block mb-0.5">Store this key safely!</span> It will not be shown again. If you lose it, you will need to generate a new key.
              </div>
            </div>

            {/* API Key box */}
            <div className="rounded-md border border-[#262626] bg-black p-4 flex items-center justify-between">
              <code className="text-sm font-mono text-white select-all overflow-x-auto max-w-[80%] pr-2 no-scrollbar">
                {apiKey.rawKey}
              </code>
              <Button
                variant="icon"
                size="icon"
                onClick={() => copyToClipboard(apiKey.rawKey)}
                tooltip="Copy key"
              >
                {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* SDK setup */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-medium uppercase tracking-wider text-[#8e9192] flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-white" />
                <span>SDK Integration Snippet</span>
              </h3>
              <div className="relative rounded-md border border-[#262626] bg-black p-4">
                <pre className="text-xs font-mono text-[#c4c7c8] overflow-x-auto select-all whitespace-pre">
                  {sdkCode}
                </pre>
                <Button
                  variant="icon"
                  size="icon"
                  onClick={() => copyToClipboard(sdkCode)}
                  tooltip="Copy snippet"
                  className="absolute top-4 right-4"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Go to dashboard */}
            <div className="pt-4 flex justify-end">
              <Link
                href={`/onboarding/declare?appId=${appId}`}
                className="flex items-center space-x-2 rounded-md bg-white hover:bg-neutral-200 px-6 py-3 text-sm font-semibold text-black transition-colors cursor-pointer"
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
