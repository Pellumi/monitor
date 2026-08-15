import * as React from "react";

import { cn } from "./utils";

export interface SwitchProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked,
      defaultChecked = false,
      onCheckedChange,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const [uncontrolledChecked, setUncontrolledChecked] =
      React.useState(defaultChecked);
    const isChecked = checked !== undefined ? checked : uncontrolledChecked;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const nextChecked = !isChecked;
      if (checked === undefined) {
        setUncontrolledChecked(nextChecked);
      }
      onCheckedChange?.(nextChecked);
      onClick?.(event);
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-disabled={disabled}
        data-state={isChecked ? "checked" : "unchecked"}
        disabled={disabled}
        ref={ref}
        onClick={handleClick}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-[2px] transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40",
          isChecked
            ? "bg-white border-white"
            : "bg-zinc-950 border-zinc-700 hover:border-zinc-500",
          className
        )}
        {...props}
      >
        <span
          data-state={isChecked ? "checked" : "unchecked"}
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-sm transition-transform duration-200 ease-in-out shadow-sm",
            isChecked
              ? "translate-x-5 bg-black"
              : "translate-x-0 bg-zinc-400"
          )}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };

