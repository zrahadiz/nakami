"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { ArrowUp, ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type PromptCategory = "furniture" | "gaming";

export interface PromptSubmitData {
  prompt: string;
  category: PromptCategory;
  image: File | null;
}

interface PromptComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;

  category: PromptCategory;
  onCategoryChange: (category: PromptCategory) => void;

  onSubmit: (data: PromptSubmitData) => Promise<void> | void;

  loading?: boolean;
  allowImages?: boolean;
  placeholder?: string;
  error?: string | null;
}

const categories = [
  {
    value: "furniture" as const,
    label: "Furniture",
    accent: "#7A8B6F",
  },
  {
    value: "gaming" as const,
    label: "Gaming Setup",
    accent: "#8B6CFF",
  },
];

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export function PromptComposer({
  prompt,
  onPromptChange,
  category,
  onCategoryChange,
  onSubmit,
  loading = false,
  allowImages = true,
  placeholder = "Describe your dream space or gaming setup...",
  error,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  // Object URLs are created in the event handlers, not an effect; this only
  // releases the last one when the composer unmounts.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function replacePreview(nextFile: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = nextFile ? URL.createObjectURL(nextFile) : null;
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function attachFile(selectedFile?: File | null) {
    if (!selectedFile) return;

    setFileError(null);

    if (!selectedFile.type.startsWith("image/")) {
      setFileError("Please choose an image file.");
      return;
    }

    if (selectedFile.size > MAX_IMAGE_SIZE) {
      setFileError("Image is too large (8 MB max).");
      return;
    }

    replacePreview(selectedFile);
    setFile(selectedFile);
  }

  function removeFile() {
    setFile(null);
    replacePreview(null);
    setFileError(null);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragging(false);

    if (!allowImages || loading) return;

    attachFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();

    if (loading) return;

    const value = prompt.trim();

    if (!value && !file) {
      textareaRef.current?.focus();
      return;
    }

    await onSubmit({
      prompt: value,
      category,
      image: file,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  const canSubmit = Boolean(prompt.trim() || file) && !loading;

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      onDragOver={(event) => {
        if (!allowImages || loading) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
      className={`
        relative rounded-[28px] border bg-card
        p-3 text-left
        shadow-[0_30px_80px_-35px_rgba(30,27,24,0.35)]
        transition sm:p-4
        ${
          dragging
            ? "border-[#D9623B] ring-4 ring-[#D9623B]/15"
            : "border-input focus-within:border-[#D9623B]/60 focus-within:ring-4 focus-within:ring-[#D9623B]/10"
        }
      `}
    >
      {/* IMAGE PREVIEW */}
      {previewUrl && (
        <div className="px-3 pt-3">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Your inspiration image"
              className="size-20 rounded-2xl object-cover"
            />

            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={removeFile}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 size-6 rounded-full"
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>
      )}

      {/* PROMPT */}
      <label htmlFor="shopping-prompt" className="sr-only">
        Describe your dream space or gaming setup
      </label>

      <Textarea
        id="shopping-prompt"
        ref={textareaRef}
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={loading}
        className="
          min-h-32 resize-none border-0 bg-transparent
          px-3 pb-1 pt-3 text-base leading-relaxed
          shadow-none
          placeholder:text-foreground/35
          focus-visible:ring-0
          sm:text-[17px]
        "
      />

      {fileError && (
        <p role="alert" className="px-3 pb-2 text-sm text-destructive">
          {fileError}
        </p>
      )}

      {/* ACTIONS */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-1 pb-1">
        {/* IMAGE UPLOAD */}
        {allowImages && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                attachFile(event.target.files?.[0])
              }
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              aria-label="Upload an inspiration image"
              className="size-10 rounded-full"
            >
              <ImagePlus className="size-4.5" />
            </Button>
          </>
        )}

        {/* CATEGORY */}
        <div
          role="radiogroup"
          aria-label="Shopping category"
          className="flex max-w-full gap-1 overflow-x-auto"
        >
          {categories.map((item) => {
            const active = category === item.value;

            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onCategoryChange(item.value)}
                disabled={loading}
                className={`
                  flex shrink-0 items-center gap-1.5
                  rounded-full px-3.5 py-2 text-sm
                  transition
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#D9623B]/40
                  disabled:opacity-60
                  ${
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/60 hover:bg-accent"
                  }
                `}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: item.accent }}
                  aria-hidden
                />

                {item.label}
              </button>
            );
          })}
        </div>

        {/* SUBMIT */}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground md:inline">
            Ctrl/⌘ + Enter
          </span>

          <Button
            type="submit"
            size="icon"
            disabled={!canSubmit}
            aria-label="Generate shopping board"
            className="
              size-11 rounded-2xl
              bg-[#D9623B] text-white
              shadow-[0_8px_20px_-8px_rgba(217,98,59,0.8)]
              hover:bg-[#C4532D]
              disabled:opacity-40
              disabled:shadow-none
            "
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowUp className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* DRAG OVERLAY */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-[28px] bg-background/90 text-base font-medium text-[#D9623B]">
          Drop your inspiration image
        </div>
      )}
    </form>
  );
}
