import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

interface AccordionContextValue {
  type: "single" | "multiple";
  value: string[];
  toggleItem: (itemValue: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  children: React.ReactNode;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      type = "single",
      value: valueProp,
      defaultValue,
      onValueChange,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isControlled = valueProp !== undefined;
    const [internalValue, setInternalValue] = React.useState<string[]>(() => {
      if (defaultValue) {
        return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
      }
      return [];
    });

    const currentValues = React.useMemo(() => {
      if (isControlled) {
        return Array.isArray(valueProp) ? valueProp : valueProp ? [valueProp] : [];
      }
      return internalValue;
    }, [isControlled, valueProp, internalValue]);

    const toggleItem = React.useCallback(
      (itemValue: string) => {
        let nextValues: string[];
        if (type === "single") {
          nextValues = currentValues.includes(itemValue) ? [] : [itemValue];
        } else {
          nextValues = currentValues.includes(itemValue)
            ? currentValues.filter((v) => v !== itemValue)
            : [...currentValues, itemValue];
        }

        if (!isControlled) {
          setInternalValue(nextValues);
        }
        onValueChange?.(type === "single" ? (nextValues[0] ?? "") : nextValues);
      },
      [type, currentValues, isControlled, onValueChange]
    );

    return (
      <AccordionContext.Provider value={{ type, value: currentValues, toggleItem }}>
        <div ref={ref} className={cn("w-full space-y-3", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = "Accordion";

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
  toggle: () => void;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

function useAccordionItem() {
  const context = React.useContext(AccordionItemContext);
  if (!context) {
    throw new Error("AccordionTrigger and AccordionContent must be used within an AccordionItem");
  }
  return context;
}

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  (
    {
      value: valueProp,
      defaultOpen = false,
      isOpen: isOpenProp,
      onOpenChange,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const itemValue = valueProp ?? generatedId;
    const accordion = React.useContext(AccordionContext);

    const [standaloneOpen, setStandaloneOpen] = React.useState(defaultOpen);
    const isStandaloneControlled = isOpenProp !== undefined;
    const isStandalone = !accordion;

    const isOpen = isStandalone
      ? (isStandaloneControlled ? isOpenProp : standaloneOpen)
      : accordion.value.includes(itemValue);

    const toggleStandalone = React.useCallback(() => {
      const nextOpen = !isOpen;
      if (!isStandaloneControlled) {
        setStandaloneOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    }, [isOpen, isStandaloneControlled, onOpenChange]);

    const itemContextValue = React.useMemo(
      () => ({
        value: itemValue,
        isOpen,
        toggle: isStandalone ? toggleStandalone : () => accordion.toggleItem(itemValue),
      }),
      [itemValue, isOpen, isStandalone, toggleStandalone, accordion]
    );

    return (
      <AccordionItemContext.Provider value={itemContextValue}>
        <div
          ref={ref}
          className={cn("border border-[#262626] bg-[#131313] rounded-xs overflow-hidden", className)}
          data-state={isOpen ? "open" : "closed"}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);
AccordionItem.displayName = "AccordionItem";

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, icon, onClick, ...props }, ref) => {
    const item = useAccordionItem();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      item.toggle();
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={item.isOpen}
        data-state={item.isOpen ? "open" : "closed"}
        onClick={handleClick}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 font-medium text-white text-sm transition-all hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        <span className="flex items-center gap-2 text-left">{children}</span>
        {icon ?? <ChevronDown className="h-4 w-4 shrink-0 text-[#8e9192] transition-transform duration-200" />}
      </button>
    );
  }
);
AccordionTrigger.displayName = "AccordionTrigger";

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => {
    const item = useAccordionItem();

    if (!item.isOpen) return null;

    return (
      <div
        ref={ref}
        data-state={item.isOpen ? "open" : "closed"}
        className={cn("px-4 pb-4 pt-3 text-sm text-[#c4c7c8] border-t border-[#262626] bg-[#000000]", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
