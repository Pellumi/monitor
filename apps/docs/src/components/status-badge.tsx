import type { DocPlan, DocStatus } from '@/lib/docs-types';

const statusLabels: Record<DocStatus, string> = {
  ga: 'GA',
  beta: 'Beta',
  preview: 'Preview',
  planned: 'Planned',
};

export function StatusBadges({ status, plans = [] }: { status: DocStatus; plans?: DocPlan[] }) {
  return <span className="docs-badges" aria-label="Availability">
    <span className={'docs-badge docs-badge-' + status}>{statusLabels[status]}</span>
    {plans.includes('enterprise') ? <span className="docs-badge docs-badge-enterprise">Enterprise</span> : null}
  </span>;
}
