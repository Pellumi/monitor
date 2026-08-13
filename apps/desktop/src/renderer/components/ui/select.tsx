/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useState, useContext, useRef, useLayoutEffect, useEffect, type ReactNode, type RefObject } from "react";
import { ChevronDown, ChevronUp, Search as SearchIcon } from "lucide-react";
import { Children, isValidElement } from "react";

interface SearchProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function Search({ value, onChange, placeholder = "Search...", className = "", autoFocus }: SearchProps) {
  return (
    <div className={`select-search-input-wrapper ${className}`}>
      <SearchIcon className="select-search-icon" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="select-search-input"
      />
    </div>
  );
}

interface SelectContextType {
  value: any;
  onValueChange: (value: any) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

interface SelectProps {
  value: any;
  onValueChange: (value: any) => void;
  children: ReactNode;
  width?: string;
  className?: string;
}

export function Select({ value, onValueChange, children, width = "", className = "" }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        isOpen,
        setIsOpen,
        containerRef,
      }}
    >
      <div ref={containerRef} className={`select-container ${className}`} style={{ width }}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps {
  children: ReactNode;
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
}

export function SelectTrigger({ children, id, name, className = "", style, disabled, ariaLabel }: SelectTriggerProps) {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error("SelectTrigger must be used within a Select component");
  }

  const { isOpen, setIsOpen } = context;

  return (
    <button
      id={id}
      name={name}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      style={style}
      onClick={() => setIsOpen(!isOpen)}
      className={`select-trigger ${className}`}
    >
      <span className="select-value">{children}</span>
      {isOpen ? <ChevronUp size={14} style={{ flexShrink: 0, marginLeft: 8 }} /> : <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: 8 }} />}
    </button>
  );
}

interface SelectValueProps {
  placeholder: string;
  className?: string;
  children?: ReactNode;
}

export function SelectValue({ placeholder, className = "", children }: SelectValueProps) {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error("SelectValue must be used within a Select component");
  }

  const { value } = context;
  const displayContent = children ?? (value ? String(value) : null);

  return (
    <span className={className}>
      {displayContent ? (
        displayContent
      ) : (
        <span className="select-value-placeholder">{placeholder}</span>
      )}
    </span>
  );
}

interface SelectContentProps {
  children: ReactNode;
  className?: string;
}

export function SelectContent({ children, className = "" }: SelectContentProps) {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error("SelectContent must be used within a Select component");
  }

  const { isOpen, containerRef } = context;
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - containerRect.bottom;
      const spaceAbove = containerRect.top;

      if (spaceBelow < 250 && spaceAbove > spaceBelow) {
        setPosition('top');
      } else {
        setPosition('bottom');
      }
    }
  }, [isOpen, containerRef]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const childrenArray = Children.toArray(children);
  const showSearch = childrenArray.length > 5;

  const getTextContent = (node: ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') {
      return String(node);
    }
    if (isValidElement(node)) {
      const props = node.props as any;
      let text = "";
      if (props.children) {
        text += getTextContent(props.children);
      }
      return text;
    }
    if (Array.isArray(node)) {
      return node.map(getTextContent).join(' ');
    }
    return '';
  };

  const filteredChildren = showSearch
    ? childrenArray.filter((child) => {
      if (isValidElement(child)) {
        const itemChildren = (child.props as any).children;
        const text = getTextContent(itemChildren);
        return text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return false;
    })
    : childrenArray;

  return (
    isOpen && (
      <div className={`select-content position-${position} ${className}`} role="listbox">
        {showSearch && (
          <div className="select-search-wrapper">
            <Search
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              autoFocus
            />
          </div>
        )}
        <div ref={scrollRef} className="select-scroll-area">
          {filteredChildren.length > 0 ? (
            filteredChildren
          ) : (
            <div className="select-empty">No results found</div>
          )}
        </div>
      </div>
    )
  );
}

interface SelectItemProps {
  value: any;
  children: ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className = "" }: SelectItemProps) {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error("SelectItem must be used within a Select component");
  }

  const { value: selectedValue, onValueChange, setIsOpen } = context;

  const handleSelect = () => {
    onValueChange(value);
    setIsOpen(false);
  };

  return (
    <button
      type="button"
      onClick={handleSelect}
      role="option"
      aria-selected={selectedValue === value}
      className={`select-item ${selectedValue === value ? "selected" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export interface SelectFieldOption {
  value: string;
  label: ReactNode;
}

export function SelectField({ value, onValueChange, options, placeholder = "Select an option", ariaLabel, disabled, className = "" }: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <Select value={value} onValueChange={onValueChange} className={className}>
      <SelectTrigger disabled={disabled} ariaLabel={ariaLabel}>
        <SelectValue placeholder={placeholder}>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
