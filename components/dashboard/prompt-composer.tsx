'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Armchair,
  ArrowUp,
  BedDouble,
  Gamepad2,
  ImagePlus,
  Loader2,
  Monitor,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
// ⚠️ Keep your existing import for createThread; adjust the path if it differs.
import { createThread } from '@/lib/api/threads'

type Category = 'furniture' | 'gaming'

const categories: { value: Category; label: string; accent: string }[] = [
  { value: 'furniture', label: 'Furniture', accent: '#7A8B6F' },
  { value: 'gaming', label: 'Gaming Setup', accent: '#8B6CFF' },
]

const suggestions = [
  {
    label: 'Living Room',
    icon: Armchair,
    category: 'furniture' as Category,
    prompt:
      'Create a cozy Japandi living room with natural wood furniture and warm neutral colors under $2000',
  },
  {
    label: 'Bedroom',
    icon: BedDouble,
    category: 'furniture' as Category,
    prompt:
      'Design a minimalist Japanese-inspired bedroom with natural wood furniture and soft lighting',
  },
  {
    label: 'Gaming Setup',
    icon: Gamepad2,
    category: 'gaming' as Category,
    prompt:
      'Build a clean black gaming setup with purple ambient lighting under $1500',
  },
  {
    label: 'Home Office',
    icon: Monitor,
    category: 'furniture' as Category,
    prompt:
      'Create a Scandinavian home office with an ergonomic desk and warm lighting under $1000',
  },
]

const accentFor = (c: Category) =>
  categories.find((x) => x.value === c)?.accent ?? '#D9623B'

export function PromptComposer() {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [prompt, setPrompt] = useState('')
  const [category, setCategory] = useState<Category>('furniture')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const value = prompt.trim()

    if (!value || loading) return

    setLoading(true)
    setError(null)

    try {
      const thread = await createThread(value.slice(0, 60), value)

      // Preserve the prompt for the upcoming chat page.
      sessionStorage.setItem(`nakami:pending-prompt:${thread.id}`, value)

      router.push(`/workspace/${thread.id}`)
    } catch (error) {
      console.error(error)
      setError('Failed to create project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSuggestion(value: string, selectedCategory: Category) {
    setPrompt(value)
    setCategory(selectedCategory)
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      handleCreate()
    }
  }

  const canSubmit = prompt.trim().length > 0 && !loading

  return (
    <div className="mx-auto w-full max-w-3xl px-1">
      {/* HEADING */}
      <div className="mb-8 text-center sm:mb-10">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-foreground/70">
          <span
            className="size-1.5 rounded-full bg-gradient-to-r from-[#D9623B] to-[#8B6CFF]"
            aria-hidden
          />
          Your ideas, made real
        </p>

        <h1 className="font-[family-name:var(--font-display)] text-[2.6rem] font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
          What will you
          <br />
          <em className="italic text-[#D9623B]">create</em> today?
        </h1>

        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Describe your dream space or gaming setup. Nakami curates the perfect
          pieces into one board.
        </p>
      </div>

      {/* INPUT */}
      <div
        className="rounded-[28px] border border-input bg-card p-3 shadow-[0_30px_80px_-35px_rgba(30,27,24,0.35)] transition focus-within:border-[#D9623B]/60 focus-within:ring-4 focus-within:ring-[#D9623B]/10 sm:p-4"
      >
        <label htmlFor="prompt" className="sr-only">
          Describe your dream space or gaming setup
        </label>
        <Textarea
          id="prompt"
          ref={textareaRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your dream space or gaming setup..."
          className="min-h-32 resize-none border-0 bg-transparent px-3 pb-1 pt-3 text-base leading-relaxed shadow-none placeholder:text-foreground/35 focus-visible:ring-0 sm:text-[17px]"
          disabled={loading}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 px-1 pb-1">
          <Button
            variant="outline"
            size="icon"
            title="Image upload coming soon"
            aria-label="Image upload coming soon"
            disabled
            className="size-10 rounded-full"
          >
            <ImagePlus className="size-[18px]" />
          </Button>

          <div
            role="radiogroup"
            aria-label="Category"
            className="flex max-w-full gap-1 overflow-x-auto"
          >
            {categories.map((c) => {
              const active = c.value === category
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategory(c.value)}
                  disabled={loading}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 disabled:opacity-60 ${
                    active
                      ? 'bg-foreground text-background'
                      : 'text-foreground/60 hover:bg-accent'
                  }`}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: c.accent }}
                    aria-hidden
                  />
                  {c.label}
                </button>
              )
            })}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:inline">
              Ctrl/⌘ + Enter
            </span>

            <Button
              size="icon"
              onClick={handleCreate}
              disabled={!canSubmit}
              aria-label="Create board"
              className="size-11 rounded-2xl bg-[#D9623B] text-white shadow-[0_8px_20px_-8px_rgba(217,98,59,0.8)] hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/30 disabled:opacity-40 disabled:shadow-none"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* SUGGESTIONS */}
      <p className="mb-3 mt-8 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Need a spark? Start from an idea
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {suggestions.map((suggestion) => {
          const accent = accentFor(suggestion.category)
          const selected = prompt === suggestion.prompt

          return (
            <button
              key={suggestion.label}
              type="button"
              onClick={() =>
                handleSuggestion(suggestion.prompt, suggestion.category)
              }
              disabled={loading}
              aria-pressed={selected}
              className="group flex flex-col items-start gap-3 rounded-2xl border bg-card p-3.5 text-left outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-[#D9623B]/25 disabled:opacity-60 sm:p-4"
              style={{
                borderColor: selected ? accent : undefined,
                boxShadow: selected ? `0 0 0 1px ${accent}` : undefined,
              }}
            >
              <span
                className="grid size-9 place-items-center rounded-xl"
                style={{ background: `${accent}22`, color: accent }}
              >
                <suggestion.icon className="size-[18px]" />
              </span>

              <span>
                <span className="block text-sm font-medium">
                  {suggestion.label}
                </span>
                <span className="mt-1 line-clamp-2 hidden text-xs leading-relaxed text-muted-foreground sm:block">
                  {suggestion.prompt}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}