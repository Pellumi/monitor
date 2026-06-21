'use client';

import { useState, useMemo, Suspense, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ReactFlow, Background, Controls, Node, Edge, applyNodeChanges, applyEdgeChanges, type OnNodesChange, type OnEdgesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ClipboardList,
  Plus,
  ArrowRight,
  Check,
  X,
  Lock,
  Unlock,
  AlertCircle,
  TrendingUp,
  Activity,
  GitCompare,
  Layers,
  ChevronRight,
  Info,
  Copy,
  Terminal,
  ShieldCheck,
  Play,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

const FDRS_API = '/api-gateway';
const ONBOARDING_API = '/api-gateway';

interface DeclaredStateSuggestion {
  id: string;
  parentStateId: string;
  suggestedStateName: string;
  category: string;
  sourceTier: string;
  rationale: string;
  confidence: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  patternId?: string;
}

interface DeclaredState {
  id: string;
  stateName: string;
  category: string;
  provenance: string;
  canonicalBehavior?: string;
  suggestions?: DeclaredStateSuggestion[];
}

interface DeclaredTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  action?: string | null;
  provenance: string;
  fromState: DeclaredState;
  toState: DeclaredState;
}

interface DeclaredFlow {
  id: string;
  name: string;
  status: 'DRAFT' | 'COMPLETE';
  version: number;
  workflowType: string;
  states: DeclaredState[];
  transitions: DeclaredTransition[];
}

interface ReconciliationReport {
  flowId: string;
  confirmedCount: number;
  trueGapCount: number;
  undeclaredCount: number;
  expectedCoverageScore: number;
  trueGaps: Array<{ stateName: string; provenance: string; declaredById: string | null }>;
  undeclared: Array<{ stateName: string; observationCount: number }>;
  confirmedTransitions: number;
  trueGapTransitions: number;
  undeclaredTransitions: number;
  transitionCoverageScore: number;
  trueGapTransitionsList: Array<{ fromStateId: string; toStateId: string; fromStateName: string; toStateName: string; action: string | null }>;
  undeclaredTransitionsList: Array<{ fromStateName: string; toStateName: string; observationCount: number }>;
  generatedAt: string;
}

function DeclareContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? 'acadai-local';
  const queryClient = useQueryClient();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowType, setNewFlowType] = useState('CUSTOM');

  // State builder inputs
  const [stateName, setStateName] = useState('');
  const [stateCategory, setStateCategory] = useState('BUSINESS');

  // Transition builder inputs
  const [fromStateId, setFromStateId] = useState('');
  const [toStateId, setToStateId] = useState('');
  const [transAction, setTransAction] = useState('');

  // Rejection modal state
  const [rejectingSugId, setRejectingSugId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Onboarding Wizard state
  const prevFlowIdRef = useRef<string>('');
  const [rawApiKey, setRawApiKey] = useState('');
  const [selectedTab, setSelectedTab] = useState<'react' | 'node'>('react');
  const [sdkReadiness, setSdkReadiness] = useState<any>(null);
  const [isCheckingSdkReadiness, setIsCheckingSdkReadiness] = useState(false);
  const [demoStatus, setDemoStatus] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Onboarding / Environment Queries
  // ─────────────────────────────────────────────────────────────

  // Fetch onboarding progress
  const { data: onboardingProgress, refetch: refetchProgress } = useQuery<any>({
    queryKey: ['onboarding-progress', appId],
    queryFn: async () => {
      const res = await fetch(`${ONBOARDING_API}/applications/${appId}/onboarding-progress`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch onboarding progress');
      return res.json();
    },
    enabled: !!appId,
  });

  // Fetch environments
  const { data: environments } = useQuery<any[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await fetch(`${ONBOARDING_API}/applications/${appId}/environments`);
      if (!res.ok) throw new Error('Failed to fetch environments');
      return res.json();
    },
    enabled: !!appId,
  });

  const activeEnv = environments?.[0]; // Default Development environment

  const checkSdkReadiness = useCallback(async () => {
    if (!appId || !activeEnv) return null;

    setIsCheckingSdkReadiness(true);
    try {
      const res = await fetch(`${ONBOARDING_API}/applications/${appId}/environments/${activeEnv.id}/sdk-readiness`);
      if (!res.ok) throw new Error('Failed to verify SDK readiness');

      const data = await res.json();
      setSdkReadiness(data);
      if (data.installationTestPassed && data.connected) {
        void refetchProgress();
      }
      return data;
    } catch (err) {
      console.error('Failed to verify SDK readiness', err);
      return null;
    } finally {
      setIsCheckingSdkReadiness(false);
    }
  }, [appId, activeEnv, refetchProgress]);

  // ─────────────────────────────────────────────────────────────
  // Onboarding Mutations
  // ─────────────────────────────────────────────────────────────

  const selectProfileMutation = useMutation({
    mutationFn: async (profileType: string) => {
      const res = await fetch(`${ONBOARDING_API}/applications/${appId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileType }),
      });
      if (!res.ok) throw new Error('Failed to set profile template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', appId] });
      queryClient.invalidateQueries({ queryKey: ['declared-flows', appId] });
    }
  });

  const patchProgressMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${ONBOARDING_API}/applications/${appId}/onboarding-progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update progress');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', appId] });
    }
  });

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      if (!activeEnv) throw new Error('No environment initialized');
      const res = await fetch(`${ONBOARDING_API}/environments/${activeEnv.id}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Onboarding API Key' }),
      });
      if (!res.ok) throw new Error('Failed to generate API key');
      const data = await res.json();
      setRawApiKey(data.rawKey);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', appId] });
    }
  });

  const analyzeDemoMutation = useMutation({
    mutationFn: async () => {
      if (!activeEnv) throw new Error('No environment initialized');
      
      // 1. Mark demo completed and first report generated
      await fetch(`${ONBOARDING_API}/applications/${appId}/onboarding-progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demonstrationCompleted: true,
          firstReportGenerated: true
        })
      });

      // 2. Trigger reconciliation
      const res = await fetch(`${FDRS_API}/applications/${appId}/reconciliation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentId: activeEnv.id })
      });
      if (!res.ok) throw new Error('Reconciliation trigger failed');

      // 3. Force auto-value realization check
      await fetch(`${ONBOARDING_API}/internal/applications/${appId}/reconcile-value`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', appId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-reports', appId] });
      refetchReconciliation();
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────

  // List flows
  const { data: flows, isLoading: isFlowsLoading } = useQuery<DeclaredFlow[]>({
    queryKey: ['declared-flows', appId],
    queryFn: async () => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow`);
      if (!res.ok) throw new Error('Failed to fetch declared flows');
      return res.json();
    },
  });

  // Get selected flow details
  const { data: activeFlow, isLoading: isActiveFlowLoading } = useQuery<DeclaredFlow>({
    queryKey: ['declared-flow-details', selectedFlowId],
    queryFn: async () => {
      if (!selectedFlowId) return null as any;
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}`);
      if (!res.ok) throw new Error('Failed to fetch flow details');
      return res.json();
    },
    enabled: !!selectedFlowId,
  });

  // Get reconciliation reports
  const { data: recReports, refetch: refetchReconciliation } = useQuery<ReconciliationReport[]>({
    queryKey: ['reconciliation-reports', appId],
    queryFn: async () => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/reconciliation`);
      if (!res.ok) throw new Error('Failed to fetch reconciliation reports');
      return res.json();
    },
    enabled: !!appId,
  });

  const activeReport = useMemo(() => {
    return recReports?.find((r) => r.flowId === selectedFlowId);
  }, [recReports, selectedFlowId]);

  // ─────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────

  const createFlowMutation = useMutation({
    mutationFn: async (data: { name: string; workflowType: string }) => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create flow');
      return res.json() as Promise<DeclaredFlow>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['declared-flows', appId] });
      setSelectedFlowId(data.id);
      setNewFlowName('');
    },
  });

  const addStateMutation = useMutation({
    mutationFn: async (data: { stateName: string; category: string; provenance: string }) => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/states`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add state');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declared-flow-details', selectedFlowId] });
      setStateName('');
    },
  });

  const addTransitionMutation = useMutation({
    mutationFn: async (data: { fromStateId: string; toStateId: string; action?: string; provenance: string }) => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add transition');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declared-flow-details', selectedFlowId] });
      setFromStateId('');
      setToStateId('');
      setTransAction('');
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (sugId: string) => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/suggestions/${sugId}/accept`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to accept suggestion');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declared-flow-details', selectedFlowId] });
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async (data: { sugId: string; reason?: string }) => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/suggestions/${data.sugId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: data.reason }),
      });
      if (!res.ok) throw new Error('Failed to reject suggestion');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declared-flow-details', selectedFlowId] });
      setRejectingSugId(null);
      setRejectionReason('');
    },
  });

  const completeFlowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/complete`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to complete flow');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declared-flows', appId] });
      queryClient.invalidateQueries({ queryKey: ['declared-flow-details', selectedFlowId] });
      refetchReconciliation();
      if (onboardingProgress && !onboardingProgress.expectedFlowsDefined) {
        patchProgressMutation.mutate({ expectedFlowsDefined: true });
      }
    },
  });

  const reopenFlowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/reopen`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to reopen flow');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declared-flows', appId] });
      queryClient.invalidateQueries({ queryKey: ['declared-flow-details', selectedFlowId] });
    },
  });

  const promoteStateMutation = useMutation({
    mutationFn: async (data: { stateName: string; accepted: boolean; reason?: string }) => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to promote state');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declared-flow-details', selectedFlowId] });
      refetchReconciliation();
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Visual Flow Diagram (using @xyflow/react)
  // ─────────────────────────────────────────────────────────────

  // Synchronize local nodes and edges state when activeFlow changes (stable dragging)
  useEffect(() => {
    if (!activeFlow) {
      setNodes([]);
      setEdges([]);
      prevFlowIdRef.current = '';
      return;
    }

    const stateList = activeFlow.states;
    const transList = activeFlow.transitions;

    const initialEdges: Edge[] = transList.map((t) => ({
      id: t.id,
      source: t.fromStateId,
      target: t.toStateId,
      label: t.action ?? '',
      type: 'smoothstep',
      animated: activeFlow.status === 'DRAFT',
      style: { stroke: '#404040' },
      labelStyle: { fill: '#737373', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#0a0a0a' },
    }));
    setEdges(initialEdges);

    if (activeFlow.id !== prevFlowIdRef.current) {
      // Switched flows: calculate new initial positions
      const initialNodes: Node[] = stateList.map((s, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        return {
          id: s.id,
          position: { x: col * 220 + 50, y: row * 150 + 50 },
          data: { label: s.stateName },
          style: {
            background: '#0a0a0a',
            color: s.category === 'ERROR' ? '#f87171' : '#e5e5e5',
            border: s.category === 'ERROR' ? '1px solid #7f1d1d' : '1px solid #262626',
            borderRadius: '8px',
            padding: '10px 15px',
            fontSize: '11px',
            fontWeight: '600',
            fontFamily: 'monospace',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          },
        };
      });
      setNodes(initialNodes);
      prevFlowIdRef.current = activeFlow.id;
    } else {
      // Same flow, update existing nodes list preserving positions
      setNodes((prevNodes) => {
        const updatedNodes = prevNodes.filter((n) => stateList.some((s) => s.id === n.id));

        stateList.forEach((s, idx) => {
          if (!updatedNodes.some((n) => n.id === s.id)) {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            updatedNodes.push({
              id: s.id,
              position: { x: col * 220 + 50, y: row * 150 + 50 },
              data: { label: s.stateName },
              style: {
                background: '#0a0a0a',
                color: s.category === 'ERROR' ? '#f87171' : '#e5e5e5',
                border: s.category === 'ERROR' ? '1px solid #7f1d1d' : '1px solid #262626',
                borderRadius: '8px',
                padding: '10px 15px',
                fontSize: '11px',
                fontWeight: '600',
                fontFamily: 'monospace',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              },
            });
          }
        });

        return updatedNodes.map((n) => {
          const s = stateList.find((x) => x.id === n.id);
          if (s) {
            return {
              ...n,
              data: { label: s.stateName },
              style: {
                ...n.style,
                color: s.category === 'ERROR' ? '#f87171' : '#e5e5e5',
                border: s.category === 'ERROR' ? '1px solid #7f1d1d' : '1px solid #262626',
              },
            };
          }
          return n;
        });
      });
    }
  }, [activeFlow]);

  // Auto-select active flow on load
  useEffect(() => {
    if (flows && flows.length > 0 && !selectedFlowId) {
      const activeDecl = flows.find((f) => f.status === 'DRAFT') || flows[0];
      if (activeDecl) {
        setSelectedFlowId(activeDecl.id);
      }
    }
  }, [flows, selectedFlowId]);

  // Poll SDK readiness status
  useEffect(() => {
    if (!appId || !activeEnv || !onboardingProgress || onboardingProgress.completedAt) return;
    if (
      onboardingProgress.templateSelected &&
      onboardingProgress.expectedFlowsDefined &&
      (!onboardingProgress.sdkConnected || !onboardingProgress.installationTestPassed)
    ) {
      void checkSdkReadiness();
      const interval = setInterval(() => {
        void checkSdkReadiness();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [appId, activeEnv, onboardingProgress, checkSdkReadiness]);

  // Poll Demonstration status
  useEffect(() => {
    if (!appId || !activeEnv || !onboardingProgress || onboardingProgress.completedAt) return;
    if (onboardingProgress.sdkConnected && !onboardingProgress.demonstrationCompleted) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${ONBOARDING_API}/applications/${appId}/environments/${activeEnv.id}/demo-status`);
          if (res.ok) {
            const data = await res.json();
            setDemoStatus(data);
          }
        } catch (err) {
          console.error('Failed to poll demo status', err);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [appId, activeEnv, onboardingProgress]);

  // Aggregate pending suggestions from all states in the flow
  const pendingSuggestions = useMemo(() => {
    if (!activeFlow) return [];
    const sugs: DeclaredStateSuggestion[] = [];
    for (const state of activeFlow.states) {
      if (state.suggestions) {
        for (const sug of state.suggestions) {
          if (sug.status === 'PENDING') {
            sugs.push(sug);
          }
        }
      }
    }
    return sugs.sort((a, b) => b.confidence - a.confidence);
  }, [activeFlow]);

  // If onboarding is active, render the onboarding wizard stages
  if (onboardingProgress && !onboardingProgress.completedAt) {
    // Stage 1: Select profile template
    if (!onboardingProgress.templateSelected) {
      return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full max-w-2xl space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 animate-pulse">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Select Application Profile</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Choose a workflow template to preload standard states and transitions, or start from scratch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'ECOMMERCE',
                  name: 'E-commerce Store',
                  desc: 'Auto-generates typical shop flow: Anonymous → Browse → View Product → Add to Cart → Checkout → Success',
                  icon: Layers,
                },
                {
                  id: 'LMS',
                  name: 'Education / LMS',
                  desc: 'Auto-generates typical learning flow: Anonymous → View Courses → Select → Enroll → Start Lesson → Complete',
                  icon: ClipboardList,
                },
                {
                  id: 'CUSTOM',
                  name: 'Custom Flow',
                  desc: 'Start with a blank canvas to construct your application\'s exact state model manually',
                  icon: Plus,
                },
              ].map((template) => {
                const IconComponent = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => selectProfileMutation.mutate(template.id)}
                    disabled={selectProfileMutation.isPending}
                    className="flex flex-col items-center p-6 bg-neutral-950/40 hover:bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 rounded-xl text-center transition-all duration-200 group"
                  >
                    <div className="p-3 bg-neutral-900 group-hover:bg-blue-500/10 rounded-lg text-neutral-400 group-hover:text-blue-400 transition-colors mb-4">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors mb-2">
                      {template.name}
                    </span>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {template.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Stage 3: SDK Connection Check
    if (onboardingProgress.expectedFlowsDefined && (!onboardingProgress.sdkConnected || !onboardingProgress.installationTestPassed)) {
      const sdkConnected = sdkReadiness?.connected ?? onboardingProgress.sdkConnected ?? false;
      const installationTestPassed = sdkReadiness?.installationTestPassed ?? onboardingProgress.installationTestPassed ?? false;
      const currentStage = !sdkConnected ? 1
        : !installationTestPassed ? 2
        : 3;

      const apiKeyToShow = rawApiKey || 'YOUR_API_KEY';
      const environmentId = activeEnv?.id || 'YOUR_ENVIRONMENT_ID';
      const sdkCode = selectedTab === 'react'
        ? `'use client';\n\nimport { useEffect, type ReactNode } from 'react';\nimport { SOTS } from '@sots/frontend-sdk';\n\nexport function SotsProvider({ children }: { children: ReactNode }) {\n  useEffect(() => {\n    SOTS.initialize({\n      endpoint: 'http://localhost:3000',\n      apiKey: '${apiKeyToShow}',\n      applicationId: '${appId}',\n      environmentId: '${environmentId}'\n    });\n\n    void SOTS.verifyInstallation();\n\n    return () => SOTS.teardown();\n  }, []);\n\n  return children;\n}`
        : `const { SOTS } = require('@sots/backend-sdk');\n\nasync function verifySotsInstall() {\n  SOTS.initialize({\n    endpoint: 'http://localhost:3000',\n    apiKey: '${apiKeyToShow}',\n    applicationId: '${appId}',\n    environmentId: '${environmentId}'\n  });\n\n  await SOTS.verifyInstallation();\n}\n\nverifySotsInstall().catch(console.error);`;

      return (
        <div className="flex min-h-[85vh] items-center justify-center px-4">
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-8 bg-neutral-900/40 border border-neutral-800 p-8 rounded-2xl backdrop-blur-xl shadow-2xl">
            
            {/* Connection Status Panel */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white">SDK Installation</h2>
                <p className="text-xs text-neutral-400 mt-1">Connect your code to the SOTS gateway.</p>
              </div>

              {/* API Key Loader */}
              {!rawApiKey && !activeEnv?.apiKeys?.length ? (
                <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/20 p-5 text-center space-y-3">
                  <p className="text-xs text-neutral-400">Generate an environment-scoped API Key for Development to start sending telemetry.</p>
                  <button
                    onClick={() => generateKeyMutation.mutate()}
                    disabled={generateKeyMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white py-2 rounded-lg transition-colors"
                  >
                    {generateKeyMutation.isPending ? 'Generating...' : 'Generate API Key'}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Development API Key</span>
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-neutral-300 truncate max-w-[80%]">
                      {rawApiKey || `${activeEnv?.apiKeys?.[0]?.keyPrefix}****************`}
                    </code>
                    {rawApiKey && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(rawApiKey);
                          alert('API Key copied!');
                        }}
                        className="p-1.5 bg-neutral-900 hover:bg-neutral-850 rounded border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {!rawApiKey && (
                    <p className="text-[10px] text-amber-400">
                      Existing keys are masked after creation. Generate a new key if you need a copy-pasteable API key.
                    </p>
                  )}
                </div>
              )}

              {/* Staged Tracker */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-neutral-400">Connection Checklist</h3>
                <div className="space-y-3">
                  {[
                    { stage: 1, label: 'Initialize SDK in code', desc: 'SOTS SDK package added & configured.' },
                    { stage: 2, label: 'Establish session connection', desc: 'At least one telemetry session observed.' },
                    { stage: 3, label: 'Onboarding test event pass', desc: 'SOTS_ONBOARDING_TEST event successfully received.' },
                  ].map((s) => {
                    const isPassed = currentStage > s.stage || (s.stage === 3 && installationTestPassed) || (s.stage === 2 && sdkConnected);
                    const isActive = currentStage === s.stage;
                    return (
                      <div key={s.stage} className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 ${isPassed ? 'border-emerald-950 bg-emerald-950/10' : isActive ? 'border-blue-900 bg-blue-950/10' : 'border-neutral-850 bg-neutral-950/10'}`}>
                        <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${isPassed ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : isActive ? 'border-blue-500 bg-blue-500/25 text-blue-400 animate-pulse' : 'border-neutral-800 text-neutral-500'}`}>
                          {isPassed ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-bold">{s.stage}</span>}
                        </div>
                        <div>
                          <span className={`text-xs font-bold ${isPassed ? 'text-emerald-400' : isActive ? 'text-blue-400' : 'text-neutral-400'}`}>{s.label}</span>
                          <p className="text-[10px] text-neutral-500 mt-0.5">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Code Integration Snippet */}
            <div className="md:col-span-3 space-y-4 flex flex-col justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                    <Terminal className="h-4 w-4 text-blue-400" />
                    <span>Quickstart Snippet</span>
                  </span>
                  <div className="flex space-x-1.5">
                    {['react', 'node'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSelectedTab(tab as any)}
                        className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase transition-colors ${selectedTab === tab ? 'bg-blue-600 text-white' : 'bg-neutral-850 text-neutral-400 hover:bg-neutral-800'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative bg-neutral-950 border border-neutral-800 p-4 rounded-xl font-mono text-[11px] text-neutral-300 leading-relaxed overflow-x-auto h-[280px]">
                  <pre className="whitespace-pre select-all">{sdkCode}</pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sdkCode);
                      alert('Snippet copied!');
                    }}
                    className="absolute top-4 right-4 p-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:text-white rounded text-neutral-400 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center text-xs text-neutral-500 bg-neutral-950/30 p-4 rounded-xl border border-neutral-850">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  <span>{isCheckingSdkReadiness ? 'Verifying SDK connection...' : 'Waiting for telemetry signals...'}</span>
                </div>
                <button
                  onClick={() => {
                    void checkSdkReadiness();
                  }}
                  disabled={isCheckingSdkReadiness}
                  className="text-blue-400 hover:underline font-semibold"
                >
                  {isCheckingSdkReadiness ? 'Checking...' : 'Force check'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Stage 4: Run Demonstration Walkthrough
    if (onboardingProgress.installationTestPassed && !onboardingProgress.demonstrationCompleted) {
      const observed = demoStatus?.observedStates ?? 0;
      const required = demoStatus?.minStatesRequired ?? 3;
      const percent = Math.min(100, Math.round((observed / required) * 100));
      const ready = demoStatus?.readyForAnalysis ?? false;

      return (
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full max-w-xl space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Play className="h-6 w-6 animate-pulse" />
              </div>
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Demonstrate Workflows</h2>
              <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
                Now start your app and interact with it. Go through at least <span className="font-semibold text-white">{required} states</span> so SOTS can build its observed behavioral model.
              </p>
            </div>

            {/* Gauge */}
            <div className="relative py-6 flex flex-col items-center justify-center">
              <div className="w-36 h-36 rounded-full border-4 border-neutral-805 flex flex-col items-center justify-center relative bg-neutral-950">
                <div
                  className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
                  style={{ animationDuration: '6s' }}
                ></div>
                <span className="text-3xl font-black text-white font-mono">{observed}</span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider mt-1">Observed</span>
              </div>
              <div className="mt-4 text-xs text-neutral-400 font-mono">
                Target: {required} states (based on expected graph scale)
              </div>
            </div>

            <div className="space-y-4">
              <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>

              {ready ? (
                <div className="rounded-lg bg-emerald-950/20 border border-emerald-900/50 p-4 text-sm text-emerald-400 flex items-start space-x-3 text-left">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Observation threshold met!</span> You have recorded enough telemetry events to run a reconciliation comparison. Click Analyze below to generate your report.
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-neutral-950/40 border border-neutral-800 p-4 text-xs text-neutral-400 text-left space-y-2">
                  <span className="font-bold text-white">Expected Flow Walkthrough Guide:</span>
                  <div className="text-[10px] text-neutral-500 mt-1">
                    To cover this profile, perform actions to visit these declared states in your app:
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activeFlow?.states.map((s: any) => (
                      <span key={s.id} className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-400 font-mono text-[9px]">
                        {s.stateName}
                      </span>
                    ))}
                  </div>
                  {activeFlow?.transitions && activeFlow.transitions.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <span className="font-semibold text-[11px] text-neutral-350">Expected Transitions:</span>
                      <div className="max-h-24 overflow-y-auto pr-1 text-[10px] text-neutral-550 font-mono space-y-0.5 mt-1">
                        {activeFlow.transitions.map((t: any) => (
                          <div key={t.id} className="flex items-center space-x-1.5">
                            <span className="text-neutral-400">{t.fromState?.stateName || 'Start'}</span>
                            <span>→</span>
                            <span className="text-neutral-300">{t.toState?.stateName || 'End'}</span>
                            {t.action && <span className="text-neutral-600">({t.action})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => analyzeDemoMutation.mutate()}
                disabled={analyzeDemoMutation.isPending || !ready}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 py-3.5 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-600/15"
              >
                {analyzeDemoMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Analyzing behavioral telemetry...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Demonstration & Generate Report</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Stage 5: Celebration & Value Realization Checkpoint
    if (onboardingProgress.demonstrationCompleted && onboardingProgress.valueRealized) {
      return (
        <div className="flex min-h-[85vh] items-center justify-center px-4">
          <div className="w-full max-w-xl space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl text-center">
            
            {/* Header */}
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Sparkles className="h-8 w-8 animate-bounce" />
              </div>
              <h2 className="mt-6 text-3xl font-black text-white tracking-tight">Behavioral QA Activated!</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Congratulations! We successfully generated your first reconciliation report and identified behavioral discrepancies in your demonstration.
              </p>
            </div>

            {/* Gap findings summary card */}
            {activeReport && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-left space-y-4">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Identified Gaps Summary</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-red-950/40 bg-red-950/5 p-3.5 rounded-lg">
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">Missing States</span>
                    <div className="text-2xl font-black text-red-400 font-mono mt-1">{activeReport.trueGapCount}</div>
                    <p className="text-[9px] text-neutral-500 mt-0.5">Defined but never reached</p>
                  </div>
                  <div className="border border-amber-950/40 bg-amber-950/5 p-3.5 rounded-lg">
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">Unexpected States</span>
                    <div className="text-2xl font-black text-amber-400 font-mono mt-1">{activeReport.undeclaredCount}</div>
                    <p className="text-[9px] text-neutral-500 mt-0.5">Reached but never declared</p>
                  </div>
                </div>
                
                {/* Insights alert */}
                <div className="text-[11px] text-neutral-400 leading-relaxed bg-neutral-900/50 p-3 rounded-lg border border-neutral-800">
                  ⚡ **SOTS Insight**: The system detected that your app behaves differently than your expectations. Click **Complete Onboarding** below to check the full behavioral diff tree and promote unexpected states!
                </div>
              </div>
            )}

            {/* Qualitative Feedback Questionnaire (Non-gating) */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-left space-y-4">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Onboarding Feedback</span>
              
              {!feedbackSubmitted ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-neutral-300">Rate your setup experience (1-5):</label>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          type="button"
                          onClick={() => setFeedbackRating(stars)}
                          className={`h-8 w-10 text-xs font-bold rounded-lg border transition-all ${feedbackRating === stars ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'}`}
                        >
                          {stars} ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-300">Any comments or issues faced?</label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Optional. Let us know what we can improve!"
                      className="w-full h-16 rounded-lg border border-neutral-800 bg-neutral-905 p-2.5 text-xs text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setFeedbackSubmitted(true);
                    }}
                    className="w-full bg-neutral-850 hover:bg-neutral-800 text-xs font-bold text-neutral-300 py-2 rounded-lg transition-colors border border-neutral-800"
                  >
                    Submit Feedback
                  </button>
                </div>
              ) : (
                <div className="text-center py-2 flex flex-col items-center">
                  <Check className="h-6 w-6 text-emerald-400 mb-2" />
                  <span className="text-xs font-semibold text-neutral-300">Thank you for your feedback!</span>
                </div>
              )}
            </div>

            {/* Complete Button */}
            <button
              onClick={() => patchProgressMutation.mutate({ completedAt: new Date() })}
              disabled={patchProgressMutation.isPending}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-600/15"
            >
              <span>Complete Onboarding & Go to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      {onboardingProgress && !onboardingProgress.expectedFlowsDefined && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start space-x-3 text-blue-400">
          <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Step 2: Define expected workflows.</span> We've preloaded a standard flow graph. Feel free to drag states around to clean up the layout, add edges, or create states. Click <span className="font-semibold">Mark Complete & Compile</span> at the top right when you are ready to configure the SDK.
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-5 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3">
            <ClipboardList className="h-8 w-8 text-blue-400" />
            <span>Flow Declaration Builder</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Author top-down intent graphs and get real-time branch state suggestions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedFlowId}
            onChange={(e) => setSelectedFlowId(e.target.value)}
            className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Select a Declared Flow --</option>
            {flows?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} (v{f.version}) [{f.status}]
              </option>
            ))}
          </select>

          {activeFlow && (
            <>
              {activeFlow.status === 'DRAFT' ? (
                <button
                  onClick={() => completeFlowMutation.mutate()}
                  disabled={completeFlowMutation.isPending || activeFlow.states.length === 0}
                  className="flex items-center space-x-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-sm font-semibold text-white transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  <span>Mark Complete & Compile</span>
                </button>
              ) : (
                <button
                  onClick={() => reopenFlowMutation.mutate()}
                  disabled={reopenFlowMutation.isPending}
                  className="flex items-center space-x-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-sm font-semibold text-white border border-neutral-700 transition-colors"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Reopen Flow for Edit</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Panel 1: Flow List & Creator + Builder */}
        <div className="lg:col-span-2 flex flex-col space-y-6 min-h-0">
          {!selectedFlowId ? (
            <div className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900/30 backdrop-blur-xl p-8 flex flex-col items-center justify-center text-center space-y-6">
              <div className="h-16 w-16 rounded-2xl bg-neutral-950 flex items-center justify-center border border-neutral-800">
                <Layers className="h-8 w-8 text-neutral-500" />
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="text-lg font-bold text-white">Create a Declared Flow</h3>
                <p className="text-xs text-neutral-400">
                  Choose an existing flow from the dropdown, or create a new flow to design your behavioral intent.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newFlowName.trim()) {
                    createFlowMutation.mutate({ name: newFlowName.trim(), workflowType: newFlowType });
                  }
                }}
                className="w-full max-w-sm space-y-4 border border-neutral-800 bg-neutral-950 p-6 rounded-xl text-left"
              >
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">FLOW NAME</label>
                  <input
                    type="text"
                    required
                    value={newFlowName}
                    onChange={(e) => setNewFlowName(e.target.value)}
                    placeholder="e.g. Checkout Flow"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">WORKFLOW TYPE</label>
                  <select
                    value={newFlowType}
                    onChange={(e) => setNewFlowType(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CUSTOM">Custom</option>
                    <option value="CHECKOUT">Checkout</option>
                    <option value="AUTHENTICATION">Authentication</option>
                    <option value="REGISTRATION">Registration</option>
                    <option value="ASSESSMENT">Assessment</option>
                    <option value="ENROLLMENT">Enrollment</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={createFlowMutation.isPending || !newFlowName.trim()}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Flow</span>
                </button>
               </form>
            </div>
          ) : !activeFlow ? (
            <div className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900/30 backdrop-blur-xl p-8 flex items-center justify-center">
              <div className="text-neutral-400 animate-pulse text-sm">Loading flow details...</div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-6 min-h-0">
              {/* Interactive Flow Visualizer */}
              <div className="h-[380px] rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden relative">
                <div className="absolute top-4 left-4 z-10 bg-neutral-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-neutral-800 flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping"></span>
                  <span className="text-xs font-semibold text-neutral-300">
                    {activeFlow.name} (v{activeFlow.version}) - {activeFlow.status}
                  </span>
                </div>

                {nodes.length > 0 ? (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                  >
                    <Background color="#222" />
                    <Controls />
                  </ReactFlow>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500 font-mono">
                    [No nodes in diagram. Add states below to begin]
                  </div>
                )}
              </div>

              {/* Builder Controls */}
              {activeFlow.status === 'DRAFT' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Add State */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (stateName.trim()) {
                        addStateMutation.mutate({
                          stateName: stateName.toUpperCase().trim(),
                          category: stateCategory,
                          provenance: 'USER_AUTHORED',
                        });
                      }
                    }}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Plus className="h-4 w-4 text-blue-400" />
                      <span>Add Declared State</span>
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">STATE NAME</label>
                        <input
                          type="text"
                          required
                          value={stateName}
                          onChange={(e) => setStateName(e.target.value)}
                          placeholder="e.g. PAYMENT_FAILED"
                          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">CATEGORY</label>
                        <select
                          value={stateCategory}
                          onChange={(e) => setStateCategory(e.target.value)}
                          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="BUSINESS">Business</option>
                          <option value="UI">UI / Interaction</option>
                          <option value="NAVIGATION">Navigation</option>
                          <option value="ERROR">Error Handling</option>
                          <option value="SYSTEM">System/API</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={addStateMutation.isPending || !stateName.trim()}
                      className="w-full flex items-center justify-center space-x-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-xs font-semibold text-white border border-neutral-750 transition-colors"
                    >
                      <span>Add State</span>
                    </button>
                  </form>

                  {/* Add Transition */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (fromStateId && toStateId) {
                        addTransitionMutation.mutate({
                          fromStateId,
                          toStateId,
                          action: transAction.trim() || undefined,
                          provenance: 'USER_AUTHORED',
                        });
                      }
                    }}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <ArrowRight className="h-4 w-4 text-blue-400" />
                      <span>Add Declared Transition</span>
                    </h3>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">FROM STATE</label>
                          <select
                            required
                            value={fromStateId}
                            onChange={(e) => setFromStateId(e.target.value)}
                            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Select...</option>
                            {activeFlow.states.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.stateName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">TO STATE</label>
                          <select
                            required
                            value={toStateId}
                            onChange={(e) => setToStateId(e.target.value)}
                            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Select...</option>
                            {activeFlow.states.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.stateName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">ACTION (OPTIONAL)</label>
                        <input
                          type="text"
                          value={transAction}
                          onChange={(e) => setTransAction(e.target.value)}
                          placeholder="e.g. CLICK_SUBMIT"
                          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={addTransitionMutation.isPending || !fromStateId || !toStateId}
                      className="w-full flex items-center justify-center space-x-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-xs font-semibold text-white border border-neutral-750 transition-colors"
                    >
                      <span>Add Transition</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel 2: Suggestions Panel & Reconciliation Summary */}
        <div className="flex flex-col space-y-6 min-h-0">
          
          {/* Suggestions List (Derivation Engine output) */}
          {activeFlow && activeFlow.status === 'DRAFT' && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5 flex flex-col h-[380px] min-h-0">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-neutral-800 pb-3 flex-shrink-0">
                <Activity className="h-4 w-4 text-blue-400" />
                <span>Derivation Suggestions ({pendingSuggestions.length})</span>
              </h2>

              <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
                {pendingSuggestions.length > 0 ? (
                  pendingSuggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3 hover:border-neutral-700 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-white font-mono">{sug.suggestedStateName}</span>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-[9px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.25 rounded font-semibold">
                              {sug.category}
                            </span>
                            <span className="text-[9px] text-neutral-500">
                              via {sug.patternId}
                            </span>
                          </div>
                        </div>

                        {/* Confidence score progress bar */}
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-blue-400 font-mono">
                            {(sug.confidence * 100).toFixed(0)}%
                          </span>
                          <div className="w-12 h-1.5 bg-neutral-850 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${sug.confidence * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[10px] text-neutral-400 leading-normal bg-neutral-900/50 p-2 rounded">
                        {sug.rationale}
                      </p>

                      <div className="flex space-x-2 pt-1">
                        <button
                          onClick={() => acceptSuggestionMutation.mutate(sug.id)}
                          className="flex-1 flex items-center justify-center space-x-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-900/50 py-1 text-xs font-semibold transition-all"
                        >
                          <Check className="h-3 w-3" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => setRejectingSugId(sug.id)}
                          className="flex-1 flex items-center justify-center space-x-1.5 rounded-lg bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-900/50 py-1 text-xs font-semibold transition-all"
                        >
                          <X className="h-3 w-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center p-6 text-xs text-neutral-500">
                    No suggestions available. Add states to see suggestions.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reconciliation Report Summary (when complete) */}
          {activeFlow && activeFlow.status === 'COMPLETE' && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5 flex flex-col max-h-[500px] min-h-0">
              <h2 className="text-sm font-bold text-white flex items-center justify-between border-b border-neutral-800 pb-3 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <GitCompare className="h-4 w-4 text-blue-400" />
                  <span>Reconciliation Status</span>
                </div>
                <button
                  onClick={() => refetchReconciliation()}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Refresh
                </button>
              </h2>

              {activeReport ? (
                <div className="flex-1 overflow-y-auto space-y-5 mt-4 pr-1">
                  
                  {/* Hero Coverage Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-center">
                      <div className="text-[10px] text-neutral-500 font-semibold tracking-wider uppercase">STATE COV</div>
                      <div className="text-2xl font-black text-white font-mono mt-1">
                        {(activeReport.expectedCoverageScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-[9px] text-neutral-400 mt-1">
                        {activeReport.confirmedCount} / {activeReport.confirmedCount + activeReport.trueGapCount} states
                      </div>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-center">
                      <div className="text-[10px] text-neutral-500 font-semibold tracking-wider uppercase">TRANS COV</div>
                      <div className="text-2xl font-black text-white font-mono mt-1">
                        {(activeReport.transitionCoverageScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-[9px] text-neutral-400 mt-1">
                        {activeReport.confirmedTransitions} / {activeReport.confirmedTransitions + activeReport.trueGapTransitions} edges
                      </div>
                    </div>
                  </div>

                  {/* True Gaps section */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-red-400 flex items-center space-x-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>True Gaps ({activeReport.trueGapCount})</span>
                    </h3>
                    <div className="space-y-1.5">
                      {activeReport.trueGaps.map((gap: any) => (
                        <div
                          key={gap.stateName}
                          className="flex items-center justify-between text-xs border border-red-950/40 bg-red-950/10 p-2.5 rounded-lg text-neutral-300"
                        >
                          <span className="font-mono">{gap.stateName}</span>
                          <span className="text-[9px] text-neutral-500">
                            {gap.provenance}
                          </span>
                        </div>
                      ))}
                      {activeReport.trueGapCount === 0 && (
                        <p className="text-[10px] text-neutral-500 italic">No missing states detected.</p>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Promotion (Undeclared states) */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Undeclared States ({activeReport.undeclaredCount})</span>
                    </h3>
                    <div className="space-y-1.5">
                      {activeReport.undeclared.map((und: any) => (
                        <div
                          key={und.stateName}
                          className="flex flex-col border border-amber-950/40 bg-amber-950/10 p-3 rounded-lg text-neutral-300"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono">{und.stateName}</span>
                            <span className="text-[10px] font-semibold text-neutral-500">{und.observationCount} visits</span>
                          </div>
                          
                          {/* Promote Button */}
                          <div className="flex space-x-2 mt-2 pt-1 border-t border-amber-950/20">
                            <button
                              onClick={() =>
                                promoteStateMutation.mutate({
                                  stateName: und.stateName,
                                  accepted: true,
                                })
                              }
                              className="flex-1 rounded bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-800 text-[10px] py-1 font-semibold transition-all"
                            >
                              Promote to Declared
                            </button>
                            <button
                              onClick={() =>
                                promoteStateMutation.mutate({
                                  stateName: und.stateName,
                                  accepted: false,
                                })
                              }
                              className="px-2.5 rounded border border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300 text-[10px] py-1 transition-all"
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      ))}
                      {activeReport.undeclaredCount === 0 && (
                        <p className="text-[10px] text-neutral-500 italic">No unexpected states observed.</p>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <Info className="h-8 w-8 text-neutral-600" />
                  <div className="max-w-[200px] text-[11px] text-neutral-400">
                    Reconciliation runs when telemetry events are observed for this flow. Click Run below to force.
                  </div>
                  <button
                    onClick={() => refetchReconciliation()}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
                  >
                    Run Reconciliation
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Suggestion Rejection Modal */}
      {rejectingSugId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Reject Suggestion</h3>
            <p className="text-xs text-neutral-400">
              Provide an optional reason for rejecting this state suggestion (feedback will be collected to train patterns).
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. This state is not applicable to our user segment."
              className="w-full h-24 rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
            />

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setRejectingSugId(null)}
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white py-2 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  rejectSuggestionMutation.mutate({
                    sugId: rejectingSugId,
                    reason: rejectionReason.trim(),
                  })
                }
                className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 text-white py-2 text-xs font-semibold transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeclarePage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading Builder...</div>}>
      <DeclareContent />
    </Suspense>
  );
}
