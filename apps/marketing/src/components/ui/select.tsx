"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./utils";

type SelectContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  contentId: string;
};

const SelectContext = createContext<SelectContextValue | undefined>(undefined);

function useSelectContext(component: string) {
  const context = useContext(SelectContext);
  if (!context) throw new Error(`${component} must be used within Select`);
  return context;
}

export function Select({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  return (
    <SelectContext.Provider
      value={{ value, onValueChange, isOpen, setIsOpen, containerRef, contentId }}
    >
      <div ref={containerRef} className={cn("relative", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const { isOpen, setIsOpen, contentId } = useSelectContext("SelectTrigger");
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") setIsOpen(false);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <button
      id={id}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={contentId}
      onClick={() => setIsOpen(!isOpen)}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex w-full items-center justify-between gap-3 border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-left text-sm text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {isOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
    </button>
  );
}

export function SelectValue({
  placeholder,
  children,
  className,
}: {
  placeholder: string;
  children?: ReactNode;
  className?: string;
}) {
  const { value } = useSelectContext("SelectValue");
  return (
    <span className={cn("truncate", className)}>
      {children ?? value ?? <span className="text-[var(--muted)]">{placeholder}</span>}
    </span>
  );
}

export function SelectContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen, setIsOpen, contentId } = useSelectContext("SelectContent");
  if (!isOpen) return null;
  return (
    <div
      id={contentId}
      role="listbox"
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
      className={cn(
        "absolute left-0 z-50 mt-2 max-h-64 w-full overflow-y-auto border border-[var(--line)] bg-[var(--surface-raised)] p-1 shadow-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SelectGroup({ children }: { children: ReactNode }) {
  return <div role="group">{children}</div>;
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: selectedValue, onValueChange, setIsOpen } =
    useSelectContext("SelectItem");
  const isSelected = value === selectedValue;
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        onValueChange(value);
        setIsOpen(false);
      }}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--surface-soft)] focus-visible:bg-[var(--surface-soft)]",
        className,
      )}
    >
      <span>{children}</span>
      {isSelected ? <Check aria-hidden="true" /> : null}
    </button>
  );
}
