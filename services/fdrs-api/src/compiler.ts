import { PrismaClient } from '@sots/db';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface CompiledRuleObj {
  ruleId: string;
  type: 'EXPECTED_STATE' | 'EXPECTED_TRANSITION';
  stateName?: string;
  fromState?: string;
  toState?: string;
  action?: string;
  source: 'USER_AUTHORED' | 'SUGGESTED_ACCEPTED' | 'DEMONSTRATION_PROMOTED';
  patternId?: string;
  confidence?: number;
}

/**
 * Compiles the declared flow states and transitions into a CompiledRuleset record
 * for the given version.
 */
export async function compileFlowRuleset(
  applicationId: string,
  flowId: string,
  version: number
): Promise<any> {
  // 1. Fetch flow, states, and transitions
  const flow = await prisma.behaviorGraph.findUnique({
    where: { id: flowId },
    include: {
      nodes: true,
      edges: {
        include: {
          fromNode: true,
          toNode: true,
        },
      },
    },
  });

  if (!flow) {
    throw new Error(`BehaviorGraph ${flowId} not found`);
  }

  const compiledRules: CompiledRuleObj[] = [];

  // 2. Compile states
  for (const node of flow.nodes) {
    // Check if this state was added via a suggestion that was accepted
    const acceptedSuggestion = await prisma.declaredStateSuggestion.findFirst({
      where: {
        parentState: { graphId: flowId },
        suggestedStateName: node.stateName,
        status: 'ACCEPTED',
      },
    });

    compiledRules.push({
      ruleId: `r_state_${crypto.randomUUID()}`,
      type: 'EXPECTED_STATE',
      stateName: node.stateName,
      source: acceptedSuggestion
        ? 'SUGGESTED_ACCEPTED'
        : (node.provenance as any),
      patternId: acceptedSuggestion?.patternId ?? undefined,
      confidence: acceptedSuggestion?.confidence ?? 1.0,
    });
  }

  // 3. Compile transitions
  for (const edge of flow.edges) {
    compiledRules.push({
      ruleId: `r_trans_${crypto.randomUUID()}`,
      type: 'EXPECTED_TRANSITION',
      fromState: edge.fromNode.stateName,
      toState: edge.toNode.stateName,
      action: edge.action ?? undefined,
      source: edge.provenance as any,
    });
  }

  // 4. Save to CompiledRuleset table
  const compiledRuleset = await prisma.compiledRuleset.upsert({
    where: {
      flowId_version: {
        flowId,
        version,
      },
    },
    update: {
      rules: compiledRules as any,
      ruleCount: compiledRules.length,
      compiledAt: new Date(),
    },
    create: {
      flowId,
      applicationId,
      version,
      rules: compiledRules as any,
      ruleCount: compiledRules.length,
      compiledAt: new Date(),
    },
  });

  return compiledRuleset;
}
