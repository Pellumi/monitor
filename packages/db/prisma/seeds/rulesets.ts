import { Prisma, PrismaClient } from '@prisma/client';
import { domainTemplates } from '@sots/rules';

const prisma = new PrismaClient();

function triggerWords(domainKey: string): string[] {
  switch (domainKey) {
    case 'ECOMMERCE':
      return ['shop', 'store', 'cart', 'checkout', 'payment', 'order', 'product', 'wishlist'];
    case 'LMS':
      return ['course', 'lesson', 'student', 'teacher', 'enroll', 'quiz', 'assessment', 'learning'];
    case 'AUTH':
      return ['login', 'register', 'auth', 'password', 'session', 'account'];
    case 'GENERIC_CRUD':
      return ['create', 'edit', 'delete', 'record', 'list', 'dashboard', 'crud'];
    default:
      return [];
  }
}

async function seedRulesets() {
  for (const template of Object.values(domainTemplates).filter((item) => item.id !== 'CUSTOM')) {
    const domain = await prisma.domain.upsert({
      where: { key: template.id },
      update: {
        name: template.name,
        description: template.description,
        isActive: true,
      },
      create: {
        key: template.id,
        name: template.name,
        description: template.description,
      },
    });

    const existingRuleset = await prisma.domainRuleset.findFirst({
      where: {
        domainId: domain.id,
        key: `${template.id}.CORE`,
        organizationId: null,
        applicationId: null,
      },
    });
    const ruleset = existingRuleset
      ? await prisma.domainRuleset.update({
        where: { id: existingRuleset.id },
        data: {
          name: `${template.name} Core Rules`,
          description: template.description,
          status: 'ACTIVE',
        },
      })
      : await prisma.domainRuleset.create({
        data: {
          domainId: domain.id,
          key: `${template.id}.CORE`,
          name: `${template.name} Core Rules`,
          description: template.description,
          scope: 'GLOBAL',
          status: 'ACTIVE',
          priority: 100,
        },
      });

    const version = await prisma.domainRulesetVersion.upsert({
      where: {
        rulesetId_version: {
          rulesetId: ruleset.id,
          version: 1,
        },
      },
      update: {
        status: 'ACTIVE',
        metadata: { seededFrom: 'packages/rules/src/templates.ts' },
      },
      create: {
        rulesetId: ruleset.id,
        version: 1,
        status: 'ACTIVE',
        changelog: 'Initial launch seed from static templates.',
        metadata: { seededFrom: 'packages/rules/src/templates.ts' },
        promotedAt: new Date(),
      },
    });

    const templatePattern = await prisma.rulePattern.upsert({
      where: { id: `${template.id.toLowerCase()}-domain-inference-v1` },
      update: {
        matcherJson: { keywords: triggerWords(template.id) },
        outputJson: { domainKey: template.id },
        isActive: true,
      },
      create: {
        id: `${template.id.toLowerCase()}-domain-inference-v1`,
        rulesetVersionId: version.id,
        key: `${template.id}.DOMAIN_INFERENCE`,
        name: `${template.name} domain inference`,
        patternType: 'DOMAIN_INFERENCE',
        severity: 'INFO',
        matcherJson: { keywords: triggerWords(template.id) },
        outputJson: { domainKey: template.id },
        confidenceBase: 0.82,
      },
    });

    for (const word of triggerWords(template.id)) {
      await prisma.ruleTrigger.upsert({
        where: { id: `${templatePattern.id}-${word}` },
        update: {
          value: word,
          weight: 1,
        },
        create: {
          id: `${templatePattern.id}-${word}`,
          rulePatternId: templatePattern.id,
          triggerType: 'KEYWORD',
          value: word,
          weight: 1,
        },
      });
    }

    await prisma.flowTemplate.upsert({
      where: { id: `${template.id.toLowerCase()}-core-flow-v1` },
      update: {
        name: template.name,
        description: template.description,
        workflowType: template.workflowType,
        statesJson: template.states as unknown as Prisma.InputJsonValue,
        transitionsJson: template.transitions as unknown as Prisma.InputJsonValue,
        edgeCasesJson: template.edgeCases as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
      create: {
        id: `${template.id.toLowerCase()}-core-flow-v1`,
        rulesetVersionId: version.id,
        key: `${template.id}.CORE_FLOW`,
        name: template.name,
        description: template.description,
        workflowType: template.workflowType,
        statesJson: template.states as unknown as Prisma.InputJsonValue,
        transitionsJson: template.transitions as unknown as Prisma.InputJsonValue,
        edgeCasesJson: template.edgeCases as unknown as Prisma.InputJsonValue,
        confidenceBase: 0.78,
      },
    });

    for (const edgeCase of template.edgeCases) {
      await prisma.rulePattern.upsert({
        where: { id: `${template.id.toLowerCase()}-${edgeCase.name.toLowerCase()}-v1` },
        update: {
          matcherJson: { trigger: edgeCase.trigger },
          outputJson: { edgeCase } as unknown as Prisma.InputJsonValue,
          isActive: true,
        },
        create: {
          id: `${template.id.toLowerCase()}-${edgeCase.name.toLowerCase()}-v1`,
          rulesetVersionId: version.id,
          key: `${template.id}.${edgeCase.name}`,
          name: edgeCase.name,
          patternType: edgeCase.category === 'ERROR' ? 'EDGE_CASE' : 'STATE_EXPECTATION',
          severity: edgeCase.criticality,
          matcherJson: { trigger: edgeCase.trigger },
          outputJson: { edgeCase } as unknown as Prisma.InputJsonValue,
          confidenceBase: edgeCase.confidence,
        },
      });
    }
  }
}

seedRulesets()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('[RulesetSeed] Failed', err);
    await prisma.$disconnect();
    process.exit(1);
  });
