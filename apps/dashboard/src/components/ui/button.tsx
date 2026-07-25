import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";
import { Spinner } from "./loader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// ─── Variant System ──────────────────────────────────────────────────────────
// Matches the monochrome black-and-white theme from auth-otp.html:
//   • Primary    → white bg, black text  (matches auth-otp.html CTA button)
//   • Secondary  → dark bg (#131313), white text, border (#262626)
//   • Danger     → transparent bg, red text+border  — monochrome red-on-black
//   • Ghost      → transparent, muted text, dark hover — for text+icon pairs
//   • Icon       → square ghost variant for icon-only buttons
//   • Accent     → neutral dark base for billing/payment accent buttons
//                  (callers add accent colour via className)

const buttonVariants = cva(
  "relative cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded " +
  "text-xs font-semibold uppercase tracking-[.08em] transition-colors " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-black " +
  "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // ── Core monochrome variants ──────────────────────────────────────
        primary:      "bg-white text-black hover:bg-neutral-200",
        secondary:    "bg-[#131313] border border-[#262626] text-white hover:bg-[#262626]",
        danger:       "bg-transparent border border-red-900/60 text-red-400 hover:bg-red-950/40",
        ghost:        "bg-transparent text-[#8e9192] hover:bg-[#262626] hover:text-white",
        icon:         "bg-transparent text-[#8e9192] hover:bg-[#262626] hover:text-white",
        // ── Accent — neutral base; caller layers colour via className ─────
        accent:       "bg-[#131313] border border-[#262626] text-white hover:border-white",
        // ── Legacy shadcn aliases ─────────────────────────────────────────
        default:      "bg-white text-black hover:bg-neutral-200",
        destructive:  "bg-transparent border border-red-900/60 text-red-400 hover:bg-red-950/40",
        outline:      "bg-[#131313] border border-[#262626] text-white hover:bg-[#262626]",
        link:         "bg-transparent text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        sm:      "h-8 px-3 py-1.5 text-[11px]",
        xs:      "h-7 px-2 py-1 text-[10px]",
        lg:      "h-12 px-6 py-3 text-sm",
        icon:    "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  tooltip?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  // NOTE: asLink / to / state (React Router) props removed.
  // Wrap with Next.js <Link> for navigation use-cases.
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      children,
      tooltip,
      tooltipSide = "top",
      ...props
    },
    ref
  ) => {
    const content = loading ? (
      <>
        <Spinner />
        <span className="sr-only">Loading</span>
      </>
    ) : (
      children
    );

    const button = (
      <button
        type={props.type ?? "button"}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={loading || props.disabled}
        ref={ref}
        {...props}
      >
        {content}
      </button>
    );

    if (tooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side={tooltipSide}>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return button;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

