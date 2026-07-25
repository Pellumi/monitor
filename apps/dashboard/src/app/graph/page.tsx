'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';

import { Suspense } from 'react';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';

const REPORT_ENGINE = '/api-gateway';

interface BehaviorGraphResponse {
  states: Array<{ id: string; name: string; visitCount: number }>;
  transitions: Array<{
    id: string;
    fromStateId: string;
    toStateId: string;
    action: string;
    frequency: number;
  }>;
}

async function fetchGraph(appId: string) {
  const res = await authenticatedFetch(`${REPORT_ENGINE}/applications/${appId}/graph`);
  if (!res.ok) throw new Error('Failed to fetch graph');
  return res.json();
}

function GraphContent() {
  const {
    appId,
    selectedOrgId,
    isLoading: isApplicationsLoading,
    error: applicationsError,
  } = useSelectedApplication();

  const { data, isLoading, error } = useQuery({
    queryKey: ['graph', appId],
    queryFn: () => fetchGraph(appId),
    enabled: !!appId,
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    
    // Very simple layout algorithm
    const graph = data as BehaviorGraphResponse;
    const nodes: Node[] = graph.states.map((s, idx) => ({
      id: s.id,
      position: { x: 250, y: idx * 100 + 50 },
      data: { label: `${s.name} (${s.visitCount})` },
      style: {
        background: '#171717',
        color: '#fff',
        border: '1px solid #262626',
        borderRadius: '8px',
        padding: '10px 20px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }
    }));

    const edges: Edge[] = graph.transitions.map((t) => ({
      id: t.id,
      source: t.fromStateId,
      target: t.toStateId,
      label: `${t.action} (${t.frequency})`,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#525252' },
      labelStyle: { fill: '#a3a3a3', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#171717' }
    }));

    return { nodes, edges };
  }, [data]);

  if (!selectedOrgId) {
    return <div className="text-neutral-400">No organization is selected.</div>;
  }
  if (isApplicationsLoading) return <div className="text-neutral-400">Loading applications...</div>;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) {
    return <ApplicationRequiredState feature="Behavioral Graph" />;
  }
  if (isLoading) return <div className="text-neutral-400">Loading graph...</div>;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (nodes.length === 0) {
    return (
      <EmptyState
        variant="activation"
        illustration="telemetry"
        eyebrow="Graph not observed"
        title="Connect the SDK to map real behavior"
        description="Tellann turns captured state transitions into a behavioral graph. Once telemetry arrives, nodes and paths will assemble here."
        primaryAction={{ label: 'Connect SDK', href: `/onboarding/api-keys?appId=${encodeURIComponent(appId)}` }}
        secondaryAction={{ label: 'Declare expected behavior', href: `/declare?appId=${encodeURIComponent(appId)}` }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-3xl font-bold mb-6">Behavioral Graph</h1>
      <div className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="#262626" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400">Loading graph...</div>}>
      <GraphContent />
    </Suspense>
  );
}
