import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { formatEnum } from '../components/desktop-ui';
import type { FlowState } from './use-flow-editor';

export type StateNodeData = { state: FlowState; unreachable: boolean; proposed: boolean };
export type StateNodeType = Node<StateNodeData, 'state'>;
export type TransitionEdgeData = { label: string; proposed: boolean };
export type TransitionEdgeType = Edge<TransitionEdgeData, 'transition'>;

const NODE_MIN_WIDTH = 168;
const NODE_MAX_WIDTH = 260;

/** Width a state card needs: 12px UI text at ~7px per character plus padding. */
export function estimateStateWidth(label: string): number {
  return Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, label.length * 7.2 + 32));
}

export function stateRoleLabel(state: Pick<FlowState, 'role' | 'terminalKind' | 'category'>): string {
  if (state.role === 'INITIAL') return 'Initial';
  if (state.role === 'TERMINAL') return `Terminal · ${formatEnum(state.terminalKind ?? 'SUCCESS')}`;
  return formatEnum(state.category || 'BUSINESS');
}

const StateNode = memo(function StateNode({ data, selected, sourcePosition, targetPosition }: NodeProps<StateNodeType>) {
  const { state, unreachable, proposed } = data;
  const role = state.role ?? 'NORMAL';
  const kicker = proposed
    ? `Proposed · ${stateRoleLabel(state)}`
    : unreachable && role !== 'INITIAL'
      ? `${stateRoleLabel(state)} · Not reachable`
      : stateRoleLabel(state);
  return (
    <div
      className="flow-node"
      data-role={role}
      data-terminal-kind={role === 'TERMINAL' ? state.terminalKind ?? 'SUCCESS' : undefined}
      data-category={state.category}
      data-selected={selected ? 'true' : undefined}
      data-unreachable={unreachable ? 'true' : undefined}
      data-proposed={proposed ? 'true' : undefined}
      style={{ maxWidth: NODE_MAX_WIDTH, minWidth: NODE_MIN_WIDTH }}
    >
      <Handle type="target" position={targetPosition ?? Position.Top} />
      <span className="flow-node-kicker">{kicker}</span>
      <span className="flow-node-label">{state.stateName}</span>
      <Handle type="source" position={sourcePosition ?? Position.Bottom} />
    </div>
  );
});

function TransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps<TransitionEdgeType>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={18}
        className={data?.proposed ? 'is-proposed' : undefined}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="flow-edge-label nodrag nopan"
            data-selected={selected ? 'true' : undefined}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title={data.label}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const flowNodeTypes = { state: StateNode };
export const flowEdgeTypes = { transition: TransitionEdge };
