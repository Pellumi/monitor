import type { SVGProps } from 'react';
import { useId } from 'react';

export type EmptyStateIllustration =
  | 'application'
  | 'telemetry'
  | 'flow'
  | 'report'
  | 'list'
  | 'coverage';

const ACTIVE_NODE: Record<EmptyStateIllustration, number> = {
  application: 0,
  telemetry: 4,
  flow: 2,
  report: 5,
  list: 1,
  coverage: 3,
};

export function BehaviorMapIllustration({
  variant,
  compact = false,
  ...props
}: { variant: EmptyStateIllustration; compact?: boolean } & SVGProps<SVGSVGElement>) {
  const activeNode = ACTIVE_NODE[variant];
  const id = useId().replace(/:/g, '');
  const gridId = `empty-grid-${variant}-${id}`;
  const glowId = `empty-glow-${variant}-${id}`;
  const fadeId = `empty-fade-${variant}-${id}`;
  const maskId = `empty-mask-${variant}-${id}`;
  const blurId = `empty-blur-${variant}-${id}`;
  const nodes = [
    [30, 72],
    [78, 38],
    [126, 68],
    [174, 31],
    [216, 72],
    [270, 45],
  ];

  return (
    <svg
      viewBox="0 0 300 110"
      role="img"
      aria-label={`${variant} setup map`}
      className={compact ? 'h-24 w-full' : 'h-40 w-full sm:h-48'}
      {...props}
    >
      <defs>
        <pattern id={gridId} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#303030" strokeWidth=".5" />
        </pattern>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor="#fff" stopOpacity=".12" />
          <stop offset=".38" stopColor="#a3a3a3" stopOpacity=".055" />
          <stop offset="1" stopColor="#090909" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={fadeId} cx="50%" cy="48%" rx="57%" ry="67%">
          <stop offset="0" stopColor="white" />
          <stop offset=".58" stopColor="white" stopOpacity=".92" />
          <stop offset=".82" stopColor="white" stopOpacity=".38" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        <mask id={maskId}>
          <rect width="300" height="110" fill={`url(#${fadeId})`} />
        </mask>
        <filter id={blurId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <g mask={`url(#${maskId})`}>
        <rect width="300" height="110" fill={`url(#${gridId})`} opacity=".42" />
        <ellipse
          cx={nodes[activeNode][0]}
          cy={nodes[activeNode][1]}
          rx="30"
          ry="30"
          fill="#a3a3a3"
          opacity=".12"
          filter={`url(#${blurId})`}
        />
        <ellipse cx={nodes[activeNode][0]} cy={nodes[activeNode][1]} rx="76" ry="58" fill={`url(#${glowId})`} />
        <path
          d="M30 72 C47 72 57 38 78 38 S105 68 126 68 S153 31 174 31 S194 72 216 72 S245 45 270 45"
          fill="none"
          stroke="#3a3a3a"
          strokeWidth="1.4"
          opacity=".72"
        />
        <path
          className="empty-state-active-path"
          d="M30 72 C47 72 57 38 78 38 S105 68 126 68 S153 31 174 31 S194 72 216 72 S245 45 270 45"
          fill="none"
          stroke="#a3a3a3"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeDasharray="22 260"
        />
        {nodes.map(([cx, cy], index) => {
          const isActive = index === activeNode;
          const isComplete = index < activeNode;
          return (
            <g key={`${cx}-${cy}`}>
              {isActive ? <circle className="empty-state-active-node" cx={cx} cy={cy} r="11" fill="#fff" opacity=".07" /> : null}
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? 4.5 : 3.5}
                fill={isActive ? '#fff' : isComplete ? '#686868' : '#171717'}
                stroke={isActive ? '#fff' : '#4a4a4a'}
                strokeWidth="1.1"
              />
            </g>
          );
        })}
      </g>
      <text x="27" y="101" fill="#4a4a4a" fontSize="6.5" fontFamily="monospace" letterSpacing="1.7">
        BEHAVIOR MAP / {variant.toUpperCase()}
      </text>
    </svg>
  );
}
