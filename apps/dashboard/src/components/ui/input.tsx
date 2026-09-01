"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  MdOutlineSearch,
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  // MdInsertLink,
  MdFormatClear,
} from "react-icons/md";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { cn } from "./utils";
import React, { useState, useRef, useEffect, forwardRef, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Label } from "./label";

const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full px-3 py-2 rounded-md border border-border bg-background outline-none focus:outline-none focus:border-primary! disabled:cursor-not-allowed disabled:opacity-50 not-placeholder-shown:border-primary/30 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

interface RichLineInputProps extends Omit<ComponentProps<"div">, "onChange" | "value"> {
  value?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  placeholder?: string;
  name?: string;
}

const RichLineInput = forwardRef<HTMLDivElement, RichLineInputProps>(
  ({ className, value, onChange, placeholder, name, ...props }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [initialLinkText] = useState("");
    const [savedSelection] = useState<Range | null>(null);
    const [activeStates, setActiveStates] = useState({
      bold: false,
      italic: false,
      underline: false,
      link: false,
    });
    const [isEmpty, setIsEmpty] = useState(!value);
    const lastValueRef = useRef(value);

    const updateActiveStates = () => {
      const selection = window.getSelection();
      let isInsideLink = false;

      if (selection && selection.rangeCount > 0) {
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
          if (node.nodeName === "A") {
            isInsideLink = true;
            break;
          }
          node = node.parentNode;
        }
      }

      setActiveStates({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        link: isInsideLink,
      });
    };


    useEffect(() => {
      const handleSelectionChange = () => {
        if (isFocused) {
          updateActiveStates();
        }
      };
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [isFocused]);

    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML === "") {
        editorRef.current.innerHTML = value || "";
        lastValueRef.current = value;
        setIsEmpty(!value || value === "<br>");
      }
      // Run once on mount to seed the editor from the initial value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      // Only update the DOM if the value from props has changed externally
      // and it's different from our last known emitted value.
      if (editorRef.current && value !== lastValueRef.current) {
        editorRef.current.innerHTML = value || "";
        lastValueRef.current = value;
        setIsEmpty(!editorRef.current.textContent?.trim());
      }
    }, [value]);


    const handleInput = () => {
      let html = editorRef.current?.innerHTML || "";
      const text = editorRef.current?.textContent?.trim() || "";

      // Normalize attributes to use single quotes to avoid issues with JSON serialization
      html = html.replace(/(\s[a-z-]+)="([^"]*)"/gi, "$1='$2'");

      lastValueRef.current = html;
      setIsEmpty(text === "");
      if (onChange) {
        onChange({
          target: {
            value: html,
            name: name,
          },
        });
      }
    };


    const execCommand = (command: string, cmdValue: string | undefined = undefined) => {
      document.execCommand(command, false, cmdValue);
      editorRef.current?.focus();
      handleInput();
      updateActiveStates();
    };


    // const addLink = () => {
    //   const selection = window.getSelection();
    //   if (selection && selection.rangeCount > 0) {
    //     const range = selection.getRangeAt(0);
    //     setSavedSelection(range.cloneRange());
    //     setInitialLinkText(selection.toString());
    //     setIsLinkDialogOpen(true);
    //   }
    // };

    const handleLinkConfirm = (text: string, url: string) => {
      if (savedSelection) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedSelection);

        // Always use insertHTML with single quotes to ensure our desired format
        const linkHtml = `<a href='${url}' class='text-blue-600 underline' target='_blank' rel='noopener noreferrer'>${text}</a>`;
        document.execCommand("insertHTML", false, linkHtml);
      }
      setIsLinkDialogOpen(false);
      handleInput();
      editorRef.current?.focus();
    };


    return (
      <div className="flex flex-col w-full group">
        <div
          contentEditable
          ref={(el) => {
            (editorRef as any).current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) (ref as any).current = el;
          }}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Small delay to allow clicking toolbar buttons
            setTimeout(() => setIsFocused(false), 200);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          className={cn(
            "min-h-10 w-full px-1 py-1 border-b border-border bg-background outline-none focus:outline-none focus:border-primary md:text-base transition-colors relative",
            isEmpty && "before:content-[attr(data-placeholder)] before:text-neutral-400 before:pointer-events-none before:absolute before:left-1 before:top-1",
            className
          )}

          data-placeholder={placeholder}
          {...props}
        />


        <div
          className={cn(
            "grid transition-[grid-template-rows,margin-top] duration-200 ease-in-out",
            isFocused ? "grid-rows-[1fr] mt-1 opacity-100" : "grid-rows-[0fr] mt-0 opacity-0 pointer-events-none"
          )}
        >
          <div className="overflow-hidden">
            <div className="flex items-center gap-1">
              <ToolbarButton onClick={() => execCommand("bold")} isActive={activeStates.bold} icon={<MdFormatBold size={20} />} title="Bold" />
              <ToolbarButton onClick={() => execCommand("italic")} isActive={activeStates.italic} icon={<MdFormatItalic size={20} />} title="Italic" />
              <ToolbarButton onClick={() => execCommand("underline")} isActive={activeStates.underline} icon={<MdFormatUnderlined size={20} />} title="Underline" />
              {/* <ToolbarButton onClick={addLink} isActive={activeStates.link} icon={<MdInsertLink size={24} />} title="Insert Link" /> */}

              <ToolbarButton onClick={() => execCommand("removeFormat")} icon={<MdFormatClear size={20} />} title="Clear Formatting" />
            </div>
          </div>

        </div>


        <LinkDialog
          isOpen={isLinkDialogOpen}
          onClose={() => {
            setIsLinkDialogOpen(false);
            editorRef.current?.focus();
          }}
          onConfirm={handleLinkConfirm}
          initialText={initialLinkText}
        />
      </div>
    );
  }
);


RichLineInput.displayName = "RichLineInput";

export const ToolbarButton = ({ onClick, icon, title, isActive }: { onClick: () => void; icon: ReactNode; title: string, isActive?: boolean }) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault(); // Prevent blurring the editor
      onClick();
    }}
    className={cn(
      "p-1 rounded transition-colors",
      isActive
        ? "bg-primary-main/15 text-primary-main"
        : "hover:bg-neutral-100 text-neutral-600"
    )}
    title={title}
  >
    {icon}
  </button>
);


export interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (text: string, url: string) => void;
  initialText: string;
}


export const LinkDialog = ({ isOpen, onClose, onConfirm, initialText }: LinkDialogProps) => {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState("");
  const [wasOpen, setWasOpen] = useState(isOpen);

  // Reset the fields when the dialog transitions to open (render-phase state
  // adjustment — avoids a state-syncing effect).
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setText(initialText);
      setUrl("");
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-white/30 z-500">
      <div
        className="bg-white rounded-xl shadow-2xl w-[90%] max-w-110 p-5 pb-2 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-neutral-900 mb-4">Add Link</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold tracking-wider">Text to display</Label>
            <LineInput
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Display text"
              className="md:text-lg border-neutral-200 focus:border-primary-main py-3"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold tracking-wider">Link to*</Label>
            <LineInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="md:text-lg border-neutral-200 focus:border-primary-main py-3"
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-6 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-4 py-2 hover:text-neutral-800 font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(text, url)}
            className="cursor-pointer px-6 py-2 bg-transparent text-primary-main hover:text-primary-main/80 font-bold transition-colors disabled:opacity-30"
            disabled={!url}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};



interface LineInputProps extends Omit<ComponentProps<"input">, "onChange"> {
  richText?: boolean;
  onChange?: (e: any) => void;
}

const LineInput = forwardRef<any, LineInputProps>(
  ({ className, type, richText, ...props }, ref) => {
    if (richText) {
      return (
        <RichLineInput
          className={className}
          ref={ref}
          {...(props as any)}
        />
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full p-1 border-b border-border bg-background outline-none focus:outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 not-placeholder-shown:border-primary/30 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

LineInput.displayName = "LineInput";

interface SearchProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  searchClassName?: string;
}

const Search: React.FC<SearchProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  searchClassName = "",
  ...props
}) => {
  return (
    <div className={cn("relative", className)}>
      <MdOutlineSearch
        className="absolute left-2.5 top-[50%] -translate-y-1/2"
        size={24}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "w-full h-full pl-10 py-2 rounded-md border-border border outline-none focus:outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 not-placeholder-shown:border-primary/30 md:text-sm bg-neutral-bg/60 placeholder-neutral-mediumGray",
          searchClassName
        )}
        {...props}
      />
    </div>
  );
};

interface PasswordProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  searchClassName?: string;
  required?: boolean;
}

const Password: React.FC<PasswordProps> = ({
  value,
  onChange,
  className = "",
  error = "",
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className="relative w-full h-max">
      <input
        required
        className={`w-full px-3 py-2  rounded-md bg-white border placeholder:text-neutral-placeholder not-placeholder-shown:border-primary outline-none focus:outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 ${className} ${error ? "border-destructive" : "border-border"
          }`}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        {...props}
      />
      <div
        className={`absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer ${error && "translate-y-[calc(-50%-12px)]"
          }`}
        onClick={togglePasswordVisibility}
      >
        {!showPassword ? (
          <FiEye size={25} color="gray" />
        ) : (
          <FiEyeOff size={25} color="gray" />
        )}
      </div>
      {error && <p className="text-sm text-primary-brightRed mt-1">{error}</p>}
    </div>
  );
};

export { Input, LineInput, Search, Password };
