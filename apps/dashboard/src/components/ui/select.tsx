/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useState, useContext, useRef, useLayoutEffect, useEffect, type ReactNode, type RefObject } from "react";
import { cn } from "./utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Children, isValidElement } from "react";

interface SearchProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  searchClassName?: string;
  autoFocus?: boolean;
}

export function Search({ value, onChange, placeholder, className, searchClassName, autoFocus }: SearchProps) {
  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <span className="absolute left-3 text-neutral-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "w-full pl-9 pr-3 py-1.5 text-xs rounded border border-[#262626] bg-black text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors",
          searchClassName
        )}
      />
    </div>
  );
}

// Define types for the context
interface SelectContextType {
  value: any;
  onValueChange: (value: any) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

// Create context with initial value and type
const SelectContext = createContext<SelectContextType | undefined>(undefined);

// Select component props
interface SelectProps {
  value: any;
  onValueChange: (value: any) => void;
  children: ReactNode;
  width?: string;
  className?: string;
}

export function Select({ value, onValueChange, children, width = "", className }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      <div ref={containerRef} className={cn("relative", className)} style={{ width }}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// SelectTrigger component props
interface SelectTriggerProps {
  children: ReactNode;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
}

export function SelectTrigger({ children, id, name, className, disabled }: SelectTriggerProps) {
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
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex items-center justify-between w-full px-3 py-2 border border-[#262626] rounded bg-black text-white text-sm cursor-pointer focus:border-white focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-all",
        className
      )}
    >
      <span className="truncate">{children}</span>
      {isOpen ? <ChevronUp className="h-4 w-4 text-white shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 text-white shrink-0 ml-2" />}
    </button>
  );
}

// SelectValue component props
interface SelectValueProps {
  placeholder: string;
  className?: string;
  children?: ReactNode;
}

export function SelectValue({ placeholder, className, children }: SelectValueProps) {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error("SelectValue must be used within a Select component");
  }

  const { value } = context;

  return (
    <span className={cn("text-white line-clamp-1", className)}>
      {children || value || <span className="text-[#8e9192]">{placeholder}</span>}
    </span>
  );
}

// SelectContent component props
interface SelectContentProps {
  children: ReactNode;
  className?: string;
}

export function SelectContent({ children, className }: SelectContentProps) {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error("SelectContent must be used within a Select component");
  }

  const { isOpen, containerRef } = context;
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowScrollUp(scrollTop > 2);
      setShowScrollDown(scrollTop + clientHeight < scrollHeight - 2);
    }
  };

  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - containerRect.bottom;
      const spaceAbove = containerRect.top;

      // If space below is less than 250px and there is more space above, open upwards
      if (spaceBelow < 250 && spaceAbove > spaceBelow) {
        setPosition('top');
      } else {
        setPosition('bottom');
      }
    }
  }, [isOpen, containerRef]);

  // Reset search when closed
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

      // Check for children
      if (props.children) {
        text += getTextContent(props.children);
      }

      // Check for 'content' prop (e.g., RichTextRenderer)
      if (props.content && typeof props.content === 'string') {
        // Strip HTML tags and join with space
        const strippedContent = props.content.replace(/<[^>]*>/g, ' ').trim();
        text += (text ? " " : "") + strippedContent;
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
        // We try to search within the children of the SelectItem or the SelectItem itself
        const itemChildren = (child.props as any).children;
        // If the child is SelectItem, its meaningful text is usually in its children
        const text = getTextContent(itemChildren);
        return text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return false;
    })
    : childrenArray;

  useEffect(() => {
    if (isOpen) {
      const handle = () => {
        handleScroll();
      };
      // Initial check after rendering
      const timeoutId = setTimeout(handle, 50);

      // Also observe size changes of scroll area
      let resizeObserver: ResizeObserver | null = null;
      if (scrollRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(handle);
        resizeObserver.observe(scrollRef.current);
      }

      return () => {
        clearTimeout(timeoutId);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  }, [isOpen, filteredChildren]);

  return (
    isOpen && (
      <div
        className={cn(
          "absolute text-sm left-0 z-[1000] w-full bg-[#131313] border border-[#262626] rounded shadow overflow-hidden flex flex-col",
          position === 'top' ? "bottom-full mb-1" : "mt-2",
          className
        )}
      >
        {showSearch && (
          <div className="p-2 border-b border-[#262626] sticky top-0 bg-[#131313] z-10">
            <Search
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-9"
              searchClassName="bg-black"
              autoFocus
            />
          </div>
        )}
        {showScrollUp && (
          <div className="py-0.5 flex justify-center items-center bg-[#131313]/90 backdrop-blur-xs border-b border-[#262626]/50 sticky top-0 z-10 pointer-events-none transition-all duration-200">
            <ChevronUp className="h-4 w-4 text-white animate-bounce" />
          </div>
        )}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[150px] overflow-y-auto no-scrollbar relative"
        >
          {filteredChildren.length > 0 ? (
            filteredChildren
          ) : (
            <div className="p-2 text-center text-[#8e9192] text-xs">No results found</div>
          )}
        </div>
        {showScrollDown && (
          <div className="py-0.5 flex justify-center items-center bg-[#131313]/90 backdrop-blur-xs border-t border-[#262626]/50 sticky bottom-0 z-10 pointer-events-none transition-all duration-200">
            <ChevronDown className="h-4 w-4 text-white animate-bounce" />
          </div>
        )}
      </div>
    )
  );
}

// SelectItem component props
interface SelectItemProps {
  value: any;
  children: ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className }: SelectItemProps) {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error("SelectItem must be used within a Select component");
  }

  const { onValueChange, setIsOpen } = context;

  const handleSelect = () => {
    onValueChange(value);
    setIsOpen(false);
  };

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={cn("block w-full px-4 py-2 text-left hover:bg-[#262626] text-white text-xs cursor-pointer transition-colors", className)}
    >
      {children}
    </button>
  );
}