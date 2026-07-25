'use client';

import Link from 'next/link';
import { useId } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import {
  BehaviorMapIllustration,
  type EmptyStateIllustration,
} from '@/components/behavior-map-illustration';

export type EmptyStateVariant = 'prerequisite' | 'activation' | 'neutral' | 'success';
export type EmptyStateLayout = 'page' | 'compact';

type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  illustration?: EmptyStateIllustration;
  layout?: EmptyStateLayout;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

const variantStyles: Record<EmptyStateVariant, string> = {
  prerequisite: 'border-[#303030]',
  activation: 'border-[#2b2b2b]',
  neutral: 'border-[#262626]',
  success: 'border-emerald-950/70',
};

function Action({
  action,
  primary,
}: {
  action: EmptyStateAction;
  primary: boolean;
}) {
  const className = primary
    ? 'group inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'
    : 'inline-flex min-h-10 items-center justify-center rounded-md border border-[#303030] bg-black/50 px-4 py-2 text-sm font-semibold text-neutral-300 transition-colors hover:border-[#484848] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
  const content = (
    <>
      {action.label}
      {primary ? <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
    </>
  );

  return action.href ? (
    <Link href={action.href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

export function EmptyState({
  variant = 'neutral',
  illustration = 'list',
  layout = 'page',
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const compact = layout === 'compact';
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={[
        'relative isolate overflow-hidden rounded-md border bg-[#0d0d0d] flex justify-center items-center',
        'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.055),transparent_65%)]',
        variantStyles[variant],
        compact ? 'px-5 py-5' : 'min-h-[440px] h-full px-5 py-8 sm:px-10 sm:py-10',
        className,
      ].join(' ')}
    >
      <div className={compact ? 'relative grid items-center gap-5 sm:grid-cols-[180px_1fr]' : 'relative mx-auto flex max-w-xl flex-col items-center text-center'}>
        <div className={compact ? 'w-full' : 'w-full max-w-lg'}>
          <BehaviorMapIllustration variant={illustration} compact={compact} aria-hidden="true" />
        </div>
        <div className={compact ? 'min-w-0' : 'mt-2'}>
          <div className={compact ? 'flex items-center gap-2' : 'flex items-center justify-center gap-2'}>
            {variant === 'success' ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-900/70 bg-emerald-950/40 text-emerald-300">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
            ) : null}
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{eyebrow}</p>
          </div>
          <h2
            id={headingId}
            className={compact ? 'mt-2 text-lg font-semibold tracking-tight text-white' : 'mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl'}
          >
            {title}
          </h2>
          <p className={compact ? 'mt-2 max-w-xl text-sm leading-6 text-neutral-400' : 'mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-400'}>
            {description}
          </p>
          {primaryAction || secondaryAction ? (
            <div className={compact ? 'mt-4 flex flex-wrap gap-2' : 'mt-6 flex flex-col justify-center gap-2 sm:flex-row'}>
              {primaryAction ? <Action action={primaryAction} primary /> : null}
              {secondaryAction ? <Action action={secondaryAction} primary={false} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
