import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type TabsContextValue = {
  value: string;
  setValue(value: string): void;
  id: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tabs components must be rendered inside Tabs");
  return context;
}

export function Tabs({
  value,
  defaultValue = "",
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?(value: string): void;
  className?: string;
  children: ReactNode;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const id = useId().replace(/:/g, "");
  const selectedValue = value ?? internalValue;
  const setValue = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  return (
    <TabsContext.Provider value={{ value: selectedValue, setValue, id }}>
      <div className={joinClasses("desktop-tabs", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export const TabsList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const triggers = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
      const current = triggers.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? triggers.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + triggers.length) % triggers.length;
      event.preventDefault();
      triggers[next]?.focus();
      triggers[next]?.click();
    };
    return (
      <div ref={ref} role="tablist" className={joinClasses("desktop-tabs-list", className)} onKeyDown={handleKeyDown} {...props}>
        {children}
      </div>
    );
  },
);
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, children, onClick, ...props }, ref) => {
  const tabs = useTabsContext();
  const selected = tabs.value === value;
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${tabs.id}-tab-${value}`}
      aria-controls={`${tabs.id}-panel-${value}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={joinClasses("desktop-tabs-trigger", className)}
      onClick={(event) => {
        tabs.setValue(value);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, children, ...props }, ref) => {
  const tabs = useTabsContext();
  if (tabs.value !== value) return null;
  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${tabs.id}-panel-${value}`}
      aria-labelledby={`${tabs.id}-tab-${value}`}
      tabIndex={0}
      className={joinClasses("desktop-tabs-content", className)}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = "TabsContent";
