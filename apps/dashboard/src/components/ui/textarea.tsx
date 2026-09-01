"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { useState, useRef, useEffect, forwardRef, type ComponentProps } from "react";
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  // MdInsertLink,
  // MdFormatListBulleted,
  // MdFormatListNumbered,
  MdFormatClear,
} from "react-icons/md";


import { cn } from "./utils";
import { ToolbarButton, LinkDialog } from "./input";

interface RichTextareaProps extends Omit<ComponentProps<"div">, "onChange" | "value"> {
  value?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  placeholder?: string;
  name?: string;
  maxLength?: number;
  maxWords?: number;
}


const RichTextarea = forwardRef<HTMLDivElement, RichTextareaProps>(
  ({ className, value, onChange, placeholder, name, maxLength, maxWords, ...props }, ref) => {

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
      listUl: false,
      listOl: false,
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
        listUl: document.queryCommandState("insertUnorderedList"),
        listOl: document.queryCommandState("insertOrderedList"),
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
      if (editorRef.current && value !== lastValueRef.current) {
        editorRef.current.innerHTML = value || "";
        lastValueRef.current = value;
        setIsEmpty(!editorRef.current.textContent?.trim());
      }
    }, [value]);

    const [charCount, setCharCount] = useState(0);
    const [wordCount, setWordCount] = useState(0);

    const getWordCount = (text: string) => {
      const words = text.trim().split(/\s+/);
      return words[0] === "" ? 0 : words.length;
    };

    useEffect(() => {
      if (editorRef.current) {
        const textContent = editorRef.current.textContent || "";
        setCharCount(textContent.length);
        setWordCount(getWordCount(textContent));
      }
    }, [value]);

    const handleInput = () => {
      const textContent = editorRef.current?.textContent || "";
      let html = editorRef.current?.innerHTML || "";

      // Normalize attributes to use single quotes to avoid issues with JSON serialization
      html = html.replace(/(\s[a-z-]+)="([^"]*)"/gi, "$1='$2'");

      lastValueRef.current = html;
      setIsEmpty(textContent.trim() === "");
      setCharCount(textContent.length);
      setWordCount(getWordCount(textContent));

      if (onChange) {
        onChange({
          target: {
            value: html,
            name: name,
          },
        });
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const textContent = editorRef.current?.textContent || "";
      const isControlKey = e.key === "Backspace" || e.key === "Delete" || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.metaKey || e.ctrlKey;

      if (maxLength && textContent.length >= maxLength && !isControlKey) {
        const selection = window.getSelection();
        if (selection && selection.toString().length === 0) {
          e.preventDefault();
          return;
        }
      }

      if (maxWords && !isControlKey) {
        const currentWords = getWordCount(textContent);
        if (currentWords >= maxWords && e.key === " ") {
          e.preventDefault();
        }
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const textContent = editorRef.current?.textContent || "";
      const pastedText = e.clipboardData.getData("text/plain");
      const selection = window.getSelection();
      const selectionLength = selection ? selection.toString().length : 0;

      if (maxLength && textContent.length - selectionLength + pastedText.length > maxLength) {
        e.preventDefault();
        const remainingSpace = maxLength - (textContent.length - selectionLength);
        if (remainingSpace > 0) {
          const truncatedPaste = pastedText.substring(0, remainingSpace);
          document.execCommand("insertText", false, truncatedPaste);
        }
        return;
      }

      if (maxWords) {
        const remainingWords = maxWords - (getWordCount(textContent) - (selection ? getWordCount(selection.toString()) : 0));
        const pastedWords = pastedText.trim().split(/\s+/);
        if (pastedWords.length > remainingWords) {
          e.preventDefault();
          if (remainingWords > 0) {
            const truncatedPaste = pastedWords.slice(0, remainingWords).join(" ");
            document.execCommand("insertText", false, truncatedPaste);
          }
        }
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
        // Use the exact attribute order and single quotes specified by the user
        const linkHtml = `<a href='${url}' class='text-blue-600 underline' target='_blank' rel='noopener noreferrer'>${text}</a>`;
        document.execCommand("insertHTML", false, linkHtml);
      }
      setIsLinkDialogOpen(false);
      handleInput();
      editorRef.current?.focus();
    };

    return (
      <div className="flex flex-col w-full group">
        <div className="relative">
          <div
            contentEditable
            ref={(el) => {
              (editorRef as any).current = el;
              if (typeof ref === "function") ref(el);
              else if (ref) (ref as any).current = el;
            }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 200);
            }}
            className={cn(
              "block w-full border-b border-border bg-background outline-none focus:outline-none p-1 text-base focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors relative overflow-y-auto overflow-x-hidden whitespace-pre-wrap",
              "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
              isEmpty && "before:content-[attr(data-placeholder)] before:text-neutral-400 before:pointer-events-none before:absolute before:left-1 before:top-1",
              className
            )}
            style={{ minHeight: "120px" }}




            data-placeholder={placeholder}
            {...props}
          />

        </div>

        {(maxLength || maxWords) && (
          <div className="mt-1 flex flex-wrap justify-end gap-3 text-xs text-gray-500 pointer-events-none">
            {maxLength && (
              <span>{Math.max(0, maxLength - charCount)} characters left</span>
            )}

            {maxWords && (
              <span>{Math.max(0, maxWords - wordCount)} words left</span>
            )}
          </div>
        )}



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
              {/* <ToolbarButton onClick={() => execCommand("insertOrderedList")} isActive={activeStates.listOl} icon={<MdFormatListNumbered size={20} />} title="Numbered List" /> */}
              {/* <ToolbarButton onClick={() => execCommand("insertUnorderedList")} isActive={activeStates.listUl} icon={<MdFormatListBulleted size={20} />} title="Bulleted List" /> */}
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

RichTextarea.displayName = "RichTextarea";

interface TextareaProps extends React.ComponentProps<"textarea"> {
  maxLength?: number;
  maxWords?: number;
  richText?: boolean;
}

const countWords = (text: string) => {
  const words = text.trim().split(/\s+/);
  return words[0] === "" ? 0 : words.length;
};

const PlainTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, onChange, maxLength, maxWords, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as any).current = node;
    };

    // Grow the field to fit its content so all text stays visible.
    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    useEffect(() => {
      resize();
    }, [value, resize]);

    useEffect(() => {
      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [resize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let inputValue = e.target.value;

      if (maxLength && inputValue.length > maxLength) {
        inputValue = inputValue.substring(0, maxLength);
      }

      if (maxWords) {
        const words = inputValue.trim().split(/\s+/);
        if (words.length > maxWords) {
          // Truncate to maxWords
          inputValue = words.slice(0, maxWords).join(" ");
        }
      }

      const modifiedEvent = {
        ...e,
        target: {
          ...e.target,
          value: inputValue,
        },
      };

      if (onChange) {
        onChange(modifiedEvent);
      }
      resize();
    };

    const remainingChars = maxLength
      ? maxLength - (value?.toString().length || 0)
      : null;

    const remainingWords = maxWords
      ? maxWords - countWords(value?.toString() || "")
      : null;

    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            "flex w-full rounded-md border border-border bg-background outline-none focus:outline-none px-3 py-2 text-base focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 not-placeholder-shown:border-primary/30 placeholder:text-muted-foreground focus-visible:outline-none md:text-sm resize-none overflow-hidden",
            className
          )}
          rows={props.rows ?? 2}
          ref={setRefs}
          value={value}
          onChange={handleChange}
          {...props}
          style={{ minHeight: "2.5rem", ...(props.style || {}) }}
        />
        {(maxLength || maxWords) && (
          <div className="mt-1 flex flex-wrap justify-end gap-3 text-xs text-gray-500 pointer-events-none">
            {maxLength && (
              <span>
                {remainingChars && remainingChars >= 0 ? remainingChars : 0}{" "}
                characters left
              </span>
            )}
            {maxWords && (
              <span>
                {remainingWords && remainingWords >= 0 ? remainingWords : 0}{" "}
                words left
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

PlainTextarea.displayName = "PlainTextarea";

const Textarea = React.forwardRef<any, TextareaProps>(
  ({ className, value, onChange, maxLength, maxWords, richText, ...props }, ref) => {
    if (richText) {
      return (
        <RichTextarea
          className={className}
          ref={ref}
          value={value as string}
          onChange={onChange as any}
          maxLength={maxLength}
          maxWords={maxWords}
          {...(props as any)}
        />
      );
    }

    return (
      <PlainTextarea
        ref={ref}
        className={className}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        maxWords={maxWords}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };

