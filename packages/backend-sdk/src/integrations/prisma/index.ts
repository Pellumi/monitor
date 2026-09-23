import { TELLANN } from '../../core/TELLANN';
import { isMutationOperation } from '../../core/trackDataAccess';

/**
 * Prisma integration.
 *
 * Prisma's types are described structurally rather than imported, so this SDK
 * never pulls `@prisma/client` into a project that does not use it. Both of
 * Prisma's interception points are supported because which one a project can
 * use depends on its version: `$extends` on 4.16 and later, `$use` before it.
 */
export type TellannPrismaOperationArgs = {
  model?: string | null;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

export type TellannPrismaMiddlewareParams = {
  model?: string | null;
  action: string;
  args?: unknown;
};

function recordCount(result: unknown): number | null {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === 'object') {
    const count = (result as { count?: unknown }).count;
    if (typeof count === 'number') return count;
    return 1;
  }
  return result === null || result === undefined ? 0 : 1;
}

async function report(model: string | null | undefined, operation: string, startedAt: number, result: unknown): Promise<void> {
  if (!model) return;
  await TELLANN.trackDataAccess({
    model,
    operation,
    records: recordCount(result),
    durationMs: Date.now() - startedAt,
    mutation: isMutationOperation(operation),
  }).catch(() => undefined);
}

/**
 * A Prisma client extension that reports every query as a data-access event.
 *
 * Usage:
 *   const prisma = new PrismaClient().$extends(tellannPrismaExtension());
 *
 * The extension reports the model and the operation, never the arguments: a
 * `where` clause routinely contains the identifiers a QA run is required not
 * to keep in the clear, and the request's own captured payload already says
 * what was asked for.
 */
export function tellannPrismaExtension() {
  return {
    name: 'tellann',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: TellannPrismaOperationArgs) {
          const startedAt = Date.now();
          const result = await query(args);
          void report(model, operation, startedAt, result);
          return result;
        },
      },
    },
  };
}

/**
 * The same reporting for Prisma clients older than 4.16, which have `$use`
 * rather than `$extends`.
 *
 * Usage:
 *   prisma.$use(tellannPrismaMiddleware());
 */
export function tellannPrismaMiddleware() {
  return async (
    params: TellannPrismaMiddlewareParams,
    next: (params: TellannPrismaMiddlewareParams) => Promise<unknown>,
  ): Promise<unknown> => {
    const startedAt = Date.now();
    const result = await next(params);
    void report(params.model, params.action, startedAt, result);
    return result;
  };
}
