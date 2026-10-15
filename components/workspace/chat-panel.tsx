"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Check,
  ImagePlus,
  LayoutGrid,
  Loader2,
  RotateCw,
  Square,
  TriangleAlert,
} from "lucide-react";

import type { Category, Message } from "@/types/workspaces";

const categories: { value: Category; label: string; accent: string }[] = [
  { value: "furniture", label: "Furniture", accent: "#7A8B6F" },
  { value: "gaming", label: "Gaming", accent: "#8B6CFF" },
];

const steps = [
  "Understanding your style…",
  "Searching retailers…",
  "Matching pieces to your budget…",
  "Staging your board…",
];

function Thinking() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
      1600,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      className="flex items-center gap-3 text-sm text-muted-foreground"
    >
      <span
        className="size-2.5 animate-pulse rounded-full bg-linear-to-r from-[#D9623B] to-[#8B6CFF]"
        aria-hidden
      />
      {steps[index]}
    </div>
  );
}

function AssistantMark() {
  return (
    <span
      aria-hidden
      className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-[#1E1B18] dark:bg-[#F2EDE3]"
    >
      <span className="font-(family-name:--font-display) text-sm leading-none text-[#F6F2EA] dark:text-[#1E1B18]">
        N
      </span>
      <span className="absolute right-1 top-1 size-1 rounded-full bg-[#D9623B]" />
    </span>
  );
}

export function ChatPanel({
  messages,
  running,
  error,
  category,
  onCategoryChange,
  onSend,
  onStop,
  onRetry,
  onShowBoard,
}: {
  messages: Message[];
  running: boolean;
  error?: string | null;
  category: Category;
  onCategoryChange: (value: Category) => void;
  onSend: (text: string) => void;
  onStop?: () => void;
  onRetry?: () => void;
  /** Mobile only: jump to the board tab. */
  onShowBoard: () => void;
}) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const last = messages[messages.length - 1];
  const lastIsLiveAssistant =
    last?.role === "assistant" && (last.content || last.activity?.length);
  const showThinking = running && !lastIsLiveAssistant;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, last?.content, last?.activity?.length, running, error]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function submit() {
    const value = input.trim();
    if (!value || running) return;
    onSend(value);
    setInput("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const lastIndex = messages.length - 1;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* header */}
      <div className="flex justify-between h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <div className="flex items-center gap-3">
          <AssistantMark />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">Nakami assistant</p>
            <p className="mt-1 text-xs leading-none text-muted-foreground">
              Curates real items into one board
            </p>
          </div>
        </div>
        <div>
          {running && <Loader2 className="size-4 animate-spin text-primary" />}
        </div>
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !running && (
          <div className="mx-auto mt-10 max-w-xs text-center">
            <p className="font-(family-name:--font-display) text-2xl font-medium">
              Describe the vibe.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Tell me the space or setup, your style and a budget. I&apos;ll
              build the board.
            </p>
          </div>
        )}

        {messages.map((message, index) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-relaxed">
                {message.content}
              </p>
            </div>
          ) : (
            <div key={message.id} className="flex gap-3">
              <AssistantMark />

              <div className="min-w-0 flex-1 space-y-3">
                {/* tool activity (product searches etc.) */}
                {message.activity && message.activity.length > 0 && (
                  <ul className="space-y-1.5" aria-label="Agent activity">
                    {message.activity.map((item) => (
                      <li
                        key={item.label}
                        className={`flex items-center gap-2 text-xs ${
                          item.failed
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.failed ? (
                          <TriangleAlert className="size-3.5" />
                        ) : item.done ? (
                          <Check className="size-3.5 text-[#7A8B6F]" />
                        ) : (
                          <span
                            className="size-2 animate-pulse rounded-full bg-linear-to-r from-[#D9623B] to-[#8B6CFF]"
                            aria-hidden
                          />
                        )}
                        {item.label}
                        {item.count > 1 ? ` ×${item.count}` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {message.workedFor !== undefined && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="size-3.5 text-[#7A8B6F]" />
                    Worked for {message.workedFor}s
                  </p>
                )}

                {message.content && (
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                    {message.content}
                  </p>
                )}

                {message.boardCount ? (
                  <button
                    type="button"
                    onClick={onShowBoard}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 lg:hidden"
                  >
                    <LayoutGrid className="size-4 text-[#D9623B]" />
                    View board ({message.boardCount} items)
                  </button>
                ) : null}

                {index === lastIndex && !running && message.suggestions && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {message.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onSend(suggestion)}
                        className="rounded-full bg-[#D9623B]/10 px-3.5 py-1.5 text-sm text-[#B84A25] outline-none transition hover:bg-[#D9623B]/18 focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 dark:text-[#F0A185]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {showThinking && (
          <div className="flex gap-3">
            <AssistantMark />
            <div className="pt-1">
              <Thinking />
            </div>
          </div>
        )}

        {error && !running && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span>{error}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium outline-none transition hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                <RotateCw className="size-3.5" />
                Try again
              </button>
            )}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="shrink-0 px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="rounded-2xl border border-input bg-card p-2.5 shadow-sm transition focus-within:border-[#D9623B]/60 focus-within:ring-4 focus-within:ring-[#D9623B]/10">
          <label htmlFor="chat-input" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Refine your board, e.g. “make it warmer, under $1,500”"
            className="block max-h-40 w-full resize-none bg-transparent px-2 pb-1 pt-1.5 text-[15px] leading-relaxed outline-none placeholder:text-foreground/35"
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Image upload coming soon"
              aria-label="Image upload coming soon"
              className="grid size-9 place-items-center rounded-full border border-border text-foreground/50 disabled:opacity-50"
            >
              <ImagePlus className="size-4" />
            </button>

            <div role="radiogroup" aria-label="Category" className="flex gap-1">
              {categories.map((c) => {
                const active = c.value === category;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onCategoryChange(c.value)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 ${
                      active
                        ? "bg-foreground text-background"
                        : "text-foreground/60 hover:bg-accent"
                    }`}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: c.accent }}
                      aria-hidden
                    />
                    {c.label}
                  </button>
                );
              })}
            </div>

            {running && onStop ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                title="Stop"
                className="ml-auto grid size-10 place-items-center rounded-xl bg-foreground text-background outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-[#D9623B]/30"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!input.trim() || running}
                aria-label="Send message"
                className="ml-auto grid size-10 place-items-center rounded-xl bg-[#D9623B] text-white shadow-[0_8px_20px_-8px_rgba(217,98,59,0.8)] outline-none transition hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/30 disabled:opacity-40 disabled:shadow-none"
              >
                <ArrowUp className="size-4.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
