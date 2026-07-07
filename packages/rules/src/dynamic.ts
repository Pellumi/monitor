import {
  CompiledFlowTemplate,
  CompiledRulePattern,
  CompiledRuleset,
  DeclaredGraphInput,
  DomainInferenceResult,
  FlowDraft,
  FlowSuggestion,
  StateTemplate,
} from './types';
import { domainTemplates, getDomainTemplate } from './templates';

type PrismaLike = {
  domainRuleset?: {
    findMany(args: unknown): Promise<any[]>;
  };
};

const DOMAIN_TRIGGER_WORDS: Record<string, string[]> = {
  ECOMMERCE: ['shop', 'store', 'cart', 'checkout', 'payment', 'order', 'product', 'wishlist', 'commerce'],
  LMS: ['course', 'lesson', 'student', 'teacher', 'enroll', 'quiz', 'assessment', 'learning', 'lms'],
  AUTH: ['login', 'register', 'auth', 'password', 'session', 'account', 'mfa'],
  GENERIC_CRUD: ['create', 'edit', 'delete', 'record', 'list', 'dashboard', 'crud', 'admin'],
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function templateToCompiledRuleset(domainKey: string): CompiledRuleset {
  const template = getDomainTemplate(domainKey);
  const flowTemplate: CompiledFlowTemplate = {
    key: template.id,
    name: template.name,
    description: template.description,
    workflowType: template.workflowType,
    states: template.states,
    transitions: template.transitions,
    edgeCases: template.edgeCases,
    confidence: 0.75,
  };
  const rulePatterns: CompiledRulePattern[] = [
    ...template.states.map((state) => ({
      key: `${template.id}.${state.name}.STATE_EXPECTATION`,
      name: `${state.name} expected state`,
      patternType: 'STATE_EXPECTATION',
      severity: 'INFO' as const,
      matcher: { stateName: state.name },
      output: { state },
      confidence: 0.75,
      triggers: [{ type: 'STATE_NAME', value: state.name, weight: 1 }],
    })),
    ...template.edgeCases.map((edgeCase) => ({
      key: `${template.id}.${edgeCase.name}.EDGE_CASE`,
      name: `${edgeCase.name} edge case`,
      patternType: 'EDGE_CASE',
      severity: edgeCase.criticality,
      matcher: { trigger: edgeCase.trigger },
      output: { edgeCase },
      confidence: edgeCase.confidence,
      triggers: [{ type: 'STATE_NAME', value: edgeCase.trigger, weight: 1 }],
    })),
  ];

  return {
    domainKey: template.id,
    version: 1,
    rulePatterns,
    flowTemplates: [flowTemplate],
    source: 'FALLBACK',
  };
}

export function getFallbackCompiledRuleset(domainKey: string): CompiledRuleset {
  return templateToCompiledRuleset(domainKey);
}

function compileDbRuleset(row: any): CompiledRuleset | null {
  const activeVersion = row.versions?.find((version: any) => version.status === 'ACTIVE') ?? row.versions?.[0];
  if (!activeVersion) return null;
  return {
    domainKey: row.domain?.key ?? 'CUSTOM',
    rulesetId: row.id,
    rulesetVersionId: activeVersion.id,
    version: activeVersion.version,
    source: 'DATABASE',
    rulePatterns: (activeVersion.patterns ?? []).map((pattern: any) => ({
      id: pattern.id,
      key: pattern.key,
      name: pattern.name,
      patternType: pattern.patternType,
      severity: pattern.severity,
      matcher: pattern.matcherJson ?? {},
      output: pattern.outputJson ?? {},
      confidence: pattern.confidenceBase ?? 0.7,
      triggers: (pattern.triggers ?? []).map((trigger: any) => ({
        type: trigger.triggerType,
        value: trigger.value,
        weight: trigger.weight ?? 1,
      })),
    })),
    flowTemplates: (activeVersion.flowTemplates ?? []).map((template: any) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      description: template.description ?? undefined,
      workflowType: template.workflowType,
      states: template.statesJson ?? [],
      transitions: template.transitionsJson ?? [],
      edgeCases: template.edgeCasesJson ?? [],
      confidence: template.confidenceBase ?? 0.75,
    })),
  };
}

export async function getActiveRulesets(input: {
  organizationId?: string;
  applicationId?: string;
  domainKey?: string;
  prisma?: PrismaLike;
}): Promise<CompiledRuleset[]> {
  const domainKey = normalizeKey(input.domainKey || 'GENERIC_CRUD');
  if (input.prisma?.domainRuleset) {
    try {
      const rows = await input.prisma.domainRuleset.findMany({
        where: {
          status: 'ACTIVE',
          domain: { key: domainKey, isActive: true },
          OR: [
            { scope: 'GLOBAL' },
            input.organizationId ? { organizationId: input.organizationId } : undefined,
            input.applicationId ? { applicationId: input.applicationId } : undefined,
          ].filter(Boolean),
        },
        include: {
          domain: true,
          versions: {
            where: { status: 'ACTIVE' },
            include: {
              patterns: { include: { triggers: true } },
              flowTemplates: true,
            },
            orderBy: { version: 'desc' },
          },
        },
        orderBy: { priority: 'asc' },
      });
      const compiled = rows.map(compileDbRuleset).filter(Boolean) as CompiledRuleset[];
      if (compiled.length > 0) return compiled;
    } catch (err) {
      console.warn('[Rules] Falling back to static ruleset after database lookup failed', err);
    }
  }
  return [getFallbackCompiledRuleset(domainKey)];
}

export async function inferDomain(input: {
  description?: string;
  routes?: string[];
  endpoints?: string[];
  labels?: string[];
  selectedDomainKey?: string;
  organizationId?: string;
  applicationId?: string;
  prisma?: PrismaLike;
}): Promise<DomainInferenceResult> {
  const scores = new Map<string, { score: number; triggers: Set<string> }>();
  for (const domainKey of Object.keys(domainTemplates)) {
    scores.set(domainKey, { score: 0, triggers: new Set() });
  }

  const applySignal = (domainKey: string, trigger: string, weight: number) => {
    const bucket = scores.get(domainKey) ?? { score: 0, triggers: new Set<string>() };
    bucket.score += weight;
    bucket.triggers.add(trigger);
    scores.set(domainKey, bucket);
  };

  const description = (input.description || '').toLowerCase();
  for (const [domainKey, words] of Object.entries(DOMAIN_TRIGGER_WORDS)) {
    for (const word of words) {
      if (description.includes(word)) applySignal(domainKey, word, 0.35 / words.length);
    }
  }

  const routeText = [...(input.routes ?? []), ...(input.endpoints ?? [])].join(' ').toLowerCase();
  for (const [domainKey, words] of Object.entries(DOMAIN_TRIGGER_WORDS)) {
    for (const word of words) {
      if (routeText.includes(word)) applySignal(domainKey, word, 0.25 / words.length);
    }
  }

  if (input.selectedDomainKey) {
    applySignal(normalizeKey(input.selectedDomainKey), 'user-selected-category', 0.2);
  }

  const labelText = (input.labels ?? []).join(' ').toLowerCase();
  for (const [domainKey, words] of Object.entries(DOMAIN_TRIGGER_WORDS)) {
    for (const word of words) {
      if (labelText.includes(word)) applySignal(domainKey, word, 0.1 / words.length);
    }
  }

  const ranked = Array.from(scores.entries())
    .map(([domainKey, value]) => ({
      domainKey,
      confidence: Math.min(0.99, Math.max(value.score, domainKey === 'GENERIC_CRUD' ? 0.2 : 0)),
      matchedTriggers: Array.from(value.triggers),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0] ?? { domainKey: 'GENERIC_CRUD', confidence: 0.2, matchedTriggers: [] };
  return {
    domainKey: best.domainKey,
    confidence: best.confidence,
    secondaryDomains: ranked.slice(1, 3).map(({ domainKey, confidence }) => ({ domainKey, confidence })),
    matchedTriggers: best.matchedTriggers,
  };
}

export async function generateRuleBasedFlow(input: {
  domainKey: string;
  productDescription?: string;
  workflowType?: string;
  rulesets: CompiledRuleset[];
}): Promise<FlowDraft> {
  const ruleset = input.rulesets[0] ?? getFallbackCompiledRuleset(input.domainKey);
  const templates = ruleset.flowTemplates.length > 0 ? ruleset.flowTemplates : getFallbackCompiledRuleset(input.domainKey).flowTemplates;
  const workflowType = input.workflowType;
  const selectedTemplates = workflowType
    ? templates.filter((template) => normalizeKey(template.workflowType) === normalizeKey(workflowType))
    : templates;
  const flowTemplates = selectedTemplates.length > 0 ? selectedTemplates : templates;

  return {
    domainKey: ruleset.domainKey,
    confidence: Math.max(...flowTemplates.map((template) => template.confidence), 0.7),
    assumptions: [
      `Generated from ${ruleset.source.toLowerCase()} ruleset version ${ruleset.version}.`,
      input.productDescription ? 'Product description was used for domain selection only; graph shape came from rules.' : 'No product description provided.',
    ],
    workflows: flowTemplates.map((template) => ({
      key: template.key,
      name: template.name,
      description: template.description,
      workflowType: template.workflowType,
      states: template.states.map((state) => ({
        ...state,
        key: normalizeKey(state.name),
        name: normalizeKey(state.name),
      })),
      transitions: template.transitions.map((transition) => ({
        from: normalizeKey(transition.from),
        to: normalizeKey(transition.to),
        action: transition.action ? normalizeKey(transition.action) : undefined,
      })),
    })),
    missingFlowCandidates: [],
    missingStateCandidates: flowTemplates.flatMap((template) =>
      template.edgeCases.map((edgeCase) => ({
        key: normalizeKey(edgeCase.name),
        title: edgeCase.name,
        reason: edgeCase.reason,
        confidence: edgeCase.confidence,
      })),
    ),
    suggestions: flowTemplates.flatMap((template) =>
      template.edgeCases.map((edgeCase) => ({
        type: edgeCase.category === 'ERROR' ? 'ERROR_PATH' as const : 'BUSINESS_RULE' as const,
        title: edgeCase.name,
        rationale: edgeCase.reason,
        confidence: edgeCase.confidence,
        severity: edgeCase.criticality,
        suggestedStates: [{ name: normalizeKey(edgeCase.name), category: edgeCase.category }],
        suggestedTransitions: [{ from: normalizeKey(edgeCase.trigger), to: normalizeKey(edgeCase.name), action: `HANDLE_${normalizeKey(edgeCase.name)}` }],
      })),
    ),
    source: 'RULE_ENGINE',
  };
}

export async function suggestFlowGaps(input: {
  domainKey: string;
  currentGraph: DeclaredGraphInput;
  rulesets: CompiledRuleset[];
}): Promise<FlowSuggestion[]> {
  const existingStates = new Set(input.currentGraph.states.map((state) => normalizeKey(state.key || state.name)));
  const ruleset = input.rulesets[0] ?? getFallbackCompiledRuleset(input.domainKey);
  const rulesetVersionIds = ruleset.rulesetVersionId ? [ruleset.rulesetVersionId] : [];
  const suggestions: FlowSuggestion[] = [];

  for (const template of ruleset.flowTemplates) {
    for (const state of template.states) {
      const key = normalizeKey(state.name);
      if (!existingStates.has(key)) {
        suggestions.push({
          type: 'PREREQUISITE',
          title: `Add ${key}`,
          rationale: `${template.name} usually includes ${key}.`,
          confidence: template.confidence,
          severity: 'MEDIUM',
          suggestedStates: [{ name: key, category: state.category }],
          suggestedTransitions: [],
          rulesetVersionIds,
          rulePatternIds: ruleset.rulePatterns
            .filter((pattern) => JSON.stringify(pattern.output).includes(state.name))
            .map((pattern) => pattern.id || pattern.key),
        });
      }
    }

    for (const edgeCase of template.edgeCases) {
      const key = normalizeKey(edgeCase.name);
      if (!existingStates.has(key)) {
        suggestions.push({
          type: edgeCase.category === 'ERROR' ? 'ERROR_PATH' : 'BUSINESS_RULE',
          title: edgeCase.name,
          rationale: edgeCase.reason,
          confidence: edgeCase.confidence,
          severity: edgeCase.criticality,
          suggestedStates: [{ name: key, category: edgeCase.category }],
          suggestedTransitions: [{ from: normalizeKey(edgeCase.trigger), to: key, action: `HANDLE_${key}` }],
          rulesetVersionIds,
          rulePatternIds: ruleset.rulePatterns
            .filter((pattern) => pattern.key.includes(edgeCase.name))
            .map((pattern) => pattern.id || pattern.key),
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 12);
}
