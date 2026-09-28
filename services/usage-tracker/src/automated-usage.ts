/**
 * Metering Automated Runs.
 *
 * An Automated Run is the one run mode that spends the platform's own resources as well as the customer's (a managed
 * browser on their machine, but report generation, storage and reconciliation on ours), and it can be started by a
 * script as easily as by a person. So it is counted, per billing period, where the other run modes are not: for capacity
 * forecasting, for spotting a runaway loop, and so a future allowance has history to be set from.
 *
 * What is counted is runs that actually *started*. A run that was created and never got as far as starting (a refused
 * prerequisite, a desktop that closed) used nothing, and counting it would penalise the person for our refusal.
 *
 * There is no limit today: Automated Run is a Business and Enterprise feature and is included in them. The count is
 * recorded with a null limit (unlimited) so that adding an allowance later is a change to a plan, not to the meter.
 */

export interface AutomatedUsagePrisma {
  qARun: {
    count(args: { where: { organizationId: string; mode: 'AUTOMATED'; startedAt: { gte: Date; lt: Date } } }): Promise<number>;
  };
}

export async function countAutomatedRuns(
  prisma: AutomatedUsagePrisma,
  organizationId: string,
  period: { start: Date; end: Date },
): Promise<number> {
  return prisma.qARun.count({
    where: { organizationId, mode: 'AUTOMATED', startedAt: { gte: period.start, lt: period.end } },
  });
}
