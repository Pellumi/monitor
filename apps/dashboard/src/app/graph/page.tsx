'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const REPORT_ENGINE = '/api-gateway';

async function fetchGraph(appId: string) {
  const res = await authenticatedFetch(`${REPORT_ENGINE}/applications/${appId}/graph`);
  if (!res.ok) throw new Error('Failed to fetch graph');
  return res.json();
}

function GraphContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? 'app-test-checkout-success.json';

  const { data, isLoading, error } = useQuery({
    queryKey: ['graph', appId],
    queryFn: () => fetchGraph(appId),
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    
    // Very simple layout algorithm
    const nodes: Node[] = data.states.map((s: any, idx: number) => ({
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

    const edges: Edge[] = data.transitions.map((t: any) => ({
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

  if (isLoading) return <div className="text-neutral-400">Loading graph...</div>;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;

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
