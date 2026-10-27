"use client";

import {
  Armchair,
  BedDouble,
  Gamepad2,
  Monitor,
  type LucideIcon,
} from "lucide-react";

import type { PromptCategory } from "./prompt-composer";

interface PromptSuggestion {
  label: string;
  description: string;
  icon: LucideIcon;
  category: PromptCategory;
  prompt: string;
}

interface PromptSuggestionsProps {
  onSelect: (suggestion: { prompt: string; category: PromptCategory }) => void;
  selectedPrompt?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const categoryAccents: Record<PromptCategory, string> = {
  furniture: "#7A8B6F",
  gaming: "#8B6CFF",
};

const suggestions: PromptSuggestion[] = [
  {
    label: "Living Room",
    description: "Warm, cozy living spaces",
    icon: Armchair,
    category: "furniture",
    prompt:
      "Create a cozy Japandi living room with natural wood furniture and warm neutral colors under $2000",
  },
  {
    label: "Bedroom",
    description: "A space to unwind",
    icon: BedDouble,
    category: "furniture",
    prompt:
      "Design a minimalist Japanese-inspired bedroom with natural wood furniture and soft lighting",
  },
  {
    label: "Gaming Setup",
    description: "Your dream battle station",
    icon: Gamepad2,
    category: "gaming",
    prompt:
      "Build a clean black gaming setup with purple ambient lighting under $1500",
  },
  {
    label: "Home Office",
    description: "Work beautifully, every day",
    icon: Monitor,
    category: "furniture",
    prompt:
      "Create a Scandinavian home office with an ergonomic desk and warm lighting under $1000",
  },
];

export function PromptSuggestions({
  onSelect,
  selectedPrompt,
  disabled = false,
  title = "Need a spark? Start from an idea",
  className = "",
}: PromptSuggestionsProps) {
  return (
    <div className={`w-full ${className}`}>
      {title && (
        <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon;
          const accent = categoryAccents[suggestion.category];
          const selected = selectedPrompt === suggestion.prompt;

          return (
            <button
              key={suggestion.label}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() =>
                onSelect({
                  prompt: suggestion.prompt,
                  category: suggestion.category,
                })
              }
              className={`
                group flex min-w-0 flex-col items-start gap-3
                rounded-2xl border bg-card p-3.5 text-left
                outline-none transition-all duration-200

                hover:-translate-y-0.5
                hover:shadow-md

                focus-visible:ring-4
                focus-visible:ring-[#D9623B]/25

                disabled:pointer-events-none
                disabled:opacity-50

                sm:p-4
              `}
              style={{
                borderColor: selected ? accent : undefined,
                boxShadow: selected ? `0 0 0 1px ${accent}` : undefined,
              }}
            >
              {/* ICON */}
              <span
                className="grid size-10 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                style={{
                  backgroundColor: `${accent}20`,
                  color: accent,
                }}
              >
                <Icon className="size-4.75" />
              </span>

              {/* CONTENT */}
              <span className="block">
                <span className="block text-sm font-medium text-foreground">
                  {suggestion.label}
                </span>

                <span className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block">
                  {suggestion.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
