'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { CAPABILITIES_QUERY_KEY } from '@/hooks/use-capabilities';

/** Architecture as detected, as confirmed, and as the resolver uses it (doc §54). */

type ArchitectureType = 'FRONTEND' | 'BACKEND' | 'MIXED' | 'UNKNOWN';
type ConfirmableType = Exclude<ArchitectureType, 'UNKNOWN'>;

interface Architecture {
  state: string;
  detectedType: ArchitectureType | null;
  confirmedType: ConfirmableType | null;
  effectiveType: ArchitectureType;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  traits?: Record<string, boolean>;
  frameworks?: Array<{ id: string; version: string | null; sdkSupport: string }>;
  reviewRequired?: boolean;
  analysisSnapshotId?: string | null;
  detectedAt?: string | null;
  confirmedAt?: string | null;
}

interface Revision {
  revisionNumber: number;
  detectedType: ArchitectureType;
  confirmedType: ConfirmableType | null;
  reason: string;
  createdAt: string;
}

const TYPE_LABEL: Record<ArchitectureType, string> = {
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  MIXED: 'Mixed (full-stack)',
  UNKNOWN: 'Not analysed',
};

const TRAIT_LABEL: Record<string, string> = {
  browserSurface: 'Browser surface',
  backendRuntime: 'Server runtime',
  apiProvider: 'Serves an API',
  apiConsumer: 'Calls an API',
  clientRouting: 'Client-side routing',
  serverRendering: 'Server rendering',
  serverActions: 'Server actions',
  managedBrowserRunnable: 'Can be launched in a browser',
};

export default function ArchitectureSettingsPage() {
  const { appId } = useSelectedApplication();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const architecture = useQuery<Architecture>({
    queryKey: ['application-architecture', appId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api-gateway/applications/${appId}/architecture`);
      if (!response.ok) throw new Error('Failed to load architecture');
      return response.json();
    },
    enabled: !!appId,
  });

  const history = useQuery<{ revisions: Revision[] }>({
    queryKey: ['application-architecture-history', appId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api-gateway/applications/${appId}/architecture/history`);
      if (!response.ok) throw new Error('Failed to load history');
      return response.json();
    },
    enabled: !!appId,
  });

  const confirm = useMutation({
    mutationFn: async (confirmedType: ConfirmableType) => {
      const response = await authenticatedFetch(`/api-gateway/applications/${appId}/architecture/confirmation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedType }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? 'Could not save the classification');
      }
      return response.json();
    },
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['application-architecture', appId] }),
        queryClient.invalidateQueries({ queryKey: ['application-architecture-history', appId] }),
        queryClient.invalidateQueries({ queryKey: [CAPABILITIES_QUERY_KEY, appId] }),
      ]);
    },
    onError: (failure: Error) => setError(failure.message),
  });

  if (!appId) {
    return <p className="p-8 text-sm text-[#737373]">Select an application to review its architecture.</p>;
  }
  if (architecture.isLoading) return <p className="p-8 text-sm text-[#737373]">Loading architecture…</p>;
  if (architecture.isError || !architecture.data) {
    return <p className="p-8 text-sm text-red-400">Architecture could not be loaded.</p>;
  }

  const data = architecture.data;
  const detected = data.detectedType;
  const pending = data.state === 'UNKNOWN_PENDING';
  const disputed = data.reviewRequired === true;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="text-lg font-semibold text-[#e5e5e5]">Architecture</h1>
        <p className="mt-1 text-sm text-[#737373]">
          Tellann detects how this application is built and uses that to decide which features apply.
        </p>
      </header>

      {disputed ? (
        <div className="rounded-md border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-200/90">
          The codebase or telemetry no longer matches the confirmed architecture. Review the classification below.
        </div>
      ) : null}

      <section className="rounded-lg border border-[#262626] bg-[#0a0a0a] p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[#737373]">Detected</dt>
            <dd className="text-[#e5e5e5]">{detected ? TYPE_LABEL[detected] : 'Not analysed'}</dd>
          </div>
          <div>
            <dt className="text-[#737373]">Confirmed</dt>
            <dd className="text-[#e5e5e5]">{data.confirmedType ? TYPE_LABEL[data.confirmedType] : 'Not confirmed'}</dd>
          </div>
          <div>
            <dt className="text-[#737373]">In use</dt>
            <dd className="text-[#e5e5e5]">{TYPE_LABEL[data.effectiveType]}</dd>
          </div>
          <div>
            <dt className="text-[#737373]">Confidence</dt>
            <dd className="text-[#e5e5e5]">{data.confidence ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {!pending && detected && detected !== 'UNKNOWN' ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[#e5e5e5]">Classification</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate(detected as ConfirmableType)}
              className="rounded-md border border-[#333] px-3 py-1.5 text-sm text-[#e5e5e5] hover:bg-[#131313] disabled:opacity-50"
            >
              Confirm {TYPE_LABEL[detected].toLowerCase()}
            </button>
            {(['FRONTEND', 'BACKEND', 'MIXED'] as const)
              .filter((type) => type !== detected)
              .map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(type)}
                  className="rounded-md border border-[#262626] px-3 py-1.5 text-sm text-[#a3a3a3] hover:bg-[#131313] disabled:opacity-50"
                >
                  Correct to {TYPE_LABEL[type].toLowerCase()}
                </button>
              ))}
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <p className="text-xs text-[#525252]">
            Tellann keeps what it detected. Your choice is recorded separately and can be changed later.
          </p>
        </section>
      ) : (
        <p className="text-sm text-[#737373]">
          Run a codebase analysis from the desktop app to detect this application&apos;s architecture.
        </p>
      )}

      {data.traits ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[#e5e5e5]">Detected capabilities</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(TRAIT_LABEL).map(([trait, label]) => (
              <li key={trait} className="flex justify-between rounded-md border border-[#1f1f1f] px-3 py-2">
                <span className="text-[#a3a3a3]">{label}</span>
                <span className={data.traits?.[trait] ? 'text-emerald-400' : 'text-[#525252]'}>
                  {data.traits?.[trait] ? 'Detected' : 'Not detected'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.frameworks && data.frameworks.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[#e5e5e5]">Frameworks</h2>
          <ul className="space-y-1 text-sm">
            {data.frameworks.map((framework) => (
              <li key={framework.id} className="flex justify-between text-[#a3a3a3]">
                <span>{framework.id}{framework.version ? ` ${framework.version}` : ''}</span>
                <span className="text-[#737373]">
                  {framework.sdkSupport === 'SUPPORTED' ? 'Instrumented by Tellann' : framework.sdkSupport === 'PLANNED' ? 'Not yet supported' : 'Unknown framework'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[#e5e5e5]">History</h2>
        {history.data?.revisions.length ? (
          <ul className="space-y-1 text-xs text-[#737373]">
            {history.data.revisions.slice().reverse().map((revision) => (
              <li key={revision.revisionNumber}>
                {new Date(revision.createdAt).toLocaleString()} · {revision.reason.toLowerCase().replace('_', ' ')} · detected {TYPE_LABEL[revision.detectedType]}
                {revision.confirmedType ? `, confirmed ${TYPE_LABEL[revision.confirmedType]}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[#525252]">No changes recorded yet.</p>
        )}
      </section>
    </div>
  );
}
