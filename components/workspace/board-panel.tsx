'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Check,
  ChevronUp,
  Loader2,
  Lock,
  LockOpen,
  Package,
  Repeat2,
  Trash2,
  TriangleAlert,
} from 'lucide-react'

import type { Job } from '@/lib/workspace/use-jobs'
import { money, total, type Board, type Product } from '@/types/workspaces'

/* ---------- small pieces ---------- */

function JobChip({ job }: { job?: Job }) {
  if (!job) return null

  if (job.status === 'ready') {
    return (
      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[#5C6B52] px-2.5 py-1 text-[11px] font-medium text-white shadow">
        <Box className="size-3" />
        3D ready
      </span>
    )
  }

  if (job.status === 'failed') {
    return (
      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[#B3261E] px-2.5 py-1 text-[11px] font-medium text-white shadow">
        <TriangleAlert className="size-3" />
        3D failed
      </span>
    )
  }

  return (
    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white shadow backdrop-blur">
      <Loader2 className="size-3 animate-spin" />
      Generating 3D
    </span>
  )
}

/* ---------- Product card ---------- */

function ProductCard({
  product,
  index,
  selected,
  job,
  dimmed,
  onToggleSelect,
  onSwap,
  onToggleLock,
  onRemove,
}: {
  product: Product
  index: number
  selected: boolean
  job?: Job
  dimmed: boolean
  onToggleSelect: (slot: string) => void
  onSwap: (slot: string, altId: string) => void
  onToggleLock: (slot: string) => void
  onRemove: (slot: string) => void
}) {
  const [shown, setShown] = useState(false)
  const [showAlts, setShowAlts] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 60 + index * 70)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-2xl border bg-card transition duration-500 ${
        shown ? 'translate-y-0' : 'translate-y-3'
      } ${shown ? (dimmed ? 'opacity-60' : 'opacity-100') : 'opacity-0'} ${
        selected ? 'border-[#D9623B] ring-2 ring-[#D9623B]/20' : 'border-border'
      }`}
    >
      {/* image */}
      <div
        className="relative h-40 overflow-hidden"
        style={{
          background: product.imageUrl
            ? '#ffffff'
            : `linear-gradient(135deg, ${product.color}, ${product.color}CC)`,
        }}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <Package aria-hidden className="absolute inset-0 m-auto size-9 text-black/25" />
        )}

        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${product.name} for 3D`}
          onClick={() => onToggleSelect(product.slot)}
          className={`absolute left-3 top-3 grid size-6 place-items-center rounded-md border-2 shadow outline-none transition focus-visible:ring-4 focus-visible:ring-[#D9623B]/30 ${
            selected
              ? 'border-[#D9623B] bg-[#D9623B] text-white'
              : 'border-black/20 bg-white text-transparent hover:border-[#D9623B]'
          }`}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>

        <span className="absolute right-3 top-3 max-w-[60%] truncate rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur">
          {product.slot}
        </span>

        <JobChip job={job} />
      </div>

      {/* info */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug">
          {product.url ? (
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="outline-none hover:underline focus-visible:underline"
            >
              {product.name}
            </a>
          ) : (
            product.name
          )}
        </h3>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {product.retailer}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-sm">
            {money(product.price)}
          </span>
        </div>

        {/* actions */}
        <div className="mt-4 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleLock(product.slot)}
            aria-pressed={product.locked}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 ${
              product.locked
                ? 'bg-[#D9623B] text-white'
                : 'border border-border text-foreground/70 hover:bg-accent'
            }`}
          >
            {product.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            {product.locked ? 'Locked' : 'Lock'}
          </button>

          <button
            type="button"
            onClick={() => setShowAlts((v) => !v)}
            aria-expanded={showAlts}
            disabled={product.alternatives.length === 0}
            title={product.alternatives.length === 0 ? 'No alternatives yet' : undefined}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-foreground/70 outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 disabled:opacity-40"
          >
            <Repeat2 className="size-3.5" />
            Swap
          </button>

          <button
            type="button"
            onClick={() => onRemove(product.slot)}
            aria-label={`Remove ${product.name}`}
            className="ml-auto grid size-9 place-items-center rounded-xl text-foreground/45 outline-none transition hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {showAlts && (
          <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
            {product.alternatives.map((alt) => {
              const delta = alt.price - product.price
              return (
                <li key={alt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSwap(product.slot, alt.id)
                      setShowAlts(false)
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
                  >
                    {alt.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={alt.imageUrl}
                        alt=""
                        loading="lazy"
                        className="size-8 shrink-0 rounded-lg bg-white object-contain"
                      />
                    ) : (
                      <span className="size-8 shrink-0 rounded-lg" style={{ background: alt.color }} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{alt.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {alt.retailer}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-[family-name:var(--font-mono)] text-xs">
                        {money(alt.price)}
                      </span>
                      <span
                        className={`block font-[family-name:var(--font-mono)] text-[11px] ${
                          delta <= 0 ? 'text-[#5C6B52]' : 'text-muted-foreground'
                        }`}
                      >
                        {delta === 0 ? 'same' : `${delta < 0 ? '−' : '+'}${money(Math.abs(delta))}`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </li>
  )
}

/* ---------- Skeleton / empty ---------- */

function BoardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-40 animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyBoard() {
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-3xl border-2 border-dashed border-input px-8 py-14 text-center">
      <p className="font-[family-name:var(--font-display)] text-2xl font-medium">
        Your board appears here
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Describe a space in the chat and I&apos;ll find real products from different
        retailers. Then select the ones you like to see them together in 3D.
      </p>
    </div>
  )
}

/* ---------- Panel ---------- */

export function BoardPanel({
  board,
  running,
  selected,
  jobs,
  generating,
  generateError,
  pinnedPreviewUrl,
  onOpenPreview,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onGenerate,
  onSwap,
  onToggleLock,
  onRemove,
}: {
  board: Board
  running: boolean
  /** Selected product slots. */
  selected: Set<string>
  /** Latest 3D job per product id. */
  jobs: Map<string, Job>
  generating: boolean
  generateError: string | null
  /** Pinned 3D scene preview, shown in the corner (opened via onOpenPreview). */
  pinnedPreviewUrl: string | null
  onOpenPreview: () => void
  onToggleSelect: (slot: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onGenerate: (slots: string[]) => Promise<void>
  onSwap: (slot: string, altId: string) => void
  onToggleLock: (slot: string) => void
  onRemove: (slot: string) => void
}) {
  const [summaryOpen, setSummaryOpen] = useState(false)

  const { products, budget } = board
  const sum = total(products)
  const over = budget !== null && sum > budget
  const pct = budget ? Math.min(100, (sum / budget) * 100) : 100
  const allSelected = products.length > 0 && selected.size === products.length

  const byRetailer = new Map<string, { count: number; subtotal: number }>()
  for (const p of products) {
    const entry = byRetailer.get(p.retailer) ?? { count: 0, subtotal: 0 }
    entry.count += 1
    entry.subtotal += p.price
    byRetailer.set(p.retailer, entry)
  }

  async function handleGenerate(slots: string[] = [...selected]) {
    await onGenerate(slots)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {products.length === 0 && running && <BoardSkeleton />}
          {products.length === 0 && !running && <EmptyBoard />}

          {products.length > 0 && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {board.category === 'gaming' ? 'Gaming setup' : 'Interior'}
                  </p>
                  <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight sm:text-3xl">
                    {board.title || 'Your board'}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  {running && (
                    <span
                      role="status"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground"
                    >
                      <span className="size-2 animate-pulse rounded-full bg-gradient-to-r from-[#D9623B] to-[#8B6CFF]" />
                      Updating…
                    </span>
                  )}
                </div>
              </div>

              <>
                  {/* budget */}
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {budget ? 'Budget' : 'Board total'}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-lg">
                        {money(sum)}
                        {budget ? (
                          <span className="text-sm text-muted-foreground"> / {money(budget)}</span>
                        ) : null}
                      </span>
                    </div>
                    {budget ? (
                      <>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: over ? '#B3261E' : '#7A8B6F' }}
                          />
                        </div>
                        <p
                          className={`mt-2 text-xs ${
                            over ? 'text-destructive' : 'text-muted-foreground'
                          }`}
                        >
                          {over ? `${money(sum - budget)} over budget` : `${money(budget - sum)} left`}
                        </p>
                      </>
                    ) : null}
                  </div>

                  {/* selection toolbar */}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={allSelected}
                      onClick={allSelected ? onClearSelection : onSelectAll}
                      className="flex items-center gap-2.5 rounded-lg py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
                    >
                      <span
                        className={`grid size-5 place-items-center rounded-md border-2 transition ${
                          allSelected
                            ? 'border-[#D9623B] bg-[#D9623B] text-white'
                            : 'border-input text-transparent'
                        }`}
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {allSelected ? 'Clear selection' : 'Select all'}
                    </button>
                    <p className="hidden text-xs text-muted-foreground sm:block">
                      Select items to place them together in 3D
                    </p>
                  </div>

                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {products.map((product, index) => (
                      <ProductCard
                        key={product.slot}
                        product={product}
                        index={index}
                        selected={selected.has(product.slot)}
                        job={jobs.get(product.id)}
                        dimmed={running && !product.locked}
                        onToggleSelect={onToggleSelect}
                        onSwap={onSwap}
                        onToggleLock={onToggleLock}
                        onRemove={onRemove}
                      />
                    ))}
                  </ul>
                </>
            </>
          )}
        </div>
      </div>

      {/* selection bar */}
      {products.length > 0 && selected.size > 0 && (
        <div className="shrink-0 border-t border-[#D9623B]/25 bg-[#D9623B]/10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
            <p className="flex items-center gap-3 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <button
                type="button"
                onClick={onClearSelection}
                className="rounded text-xs text-foreground/60 underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
              >
                Clear
              </button>
            </p>

            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#D9623B] px-4 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(217,98,59,0.9)] outline-none transition hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/30 disabled:opacity-60"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Box className="size-4" />}
              Generate 3D scene
            </button>
          </div>

          {generateError && (
            <p role="alert" className="mx-auto max-w-5xl px-4 pb-2.5 text-xs text-destructive sm:px-6 lg:px-8">
              {generateError}
            </p>
          )}
        </div>
      )}

      {/* total + checkout (payment is not built yet) */}
      {products.length > 0 && (
        <footer className="shrink-0 border-t border-border bg-card/95 backdrop-blur">
          {summaryOpen && (
            <div className="border-b border-border">
              <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
                <ul className="divide-y divide-border">
                  {[...byRetailer.entries()].map(([retailer, info]) => (
                    <li key={retailer} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span>
                        {retailer}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {info.count} {info.count === 1 ? 'item' : 'items'}
                        </span>
                      </span>
                      <span className="font-[family-name:var(--font-mono)]">{money(info.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                {/* TODO: replace with PayPal's official buttons once payments are built. */}
                <button
                  type="button"
                  disabled
                  className="mt-4 h-12 w-full cursor-not-allowed rounded-full bg-muted text-sm font-medium text-muted-foreground"
                >
                  Payment coming soon
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-mono)] text-xl leading-none">{money(sum)}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {products.length} items · {byRetailer.size}{' '}
                {byRetailer.size === 1 ? 'retailer' : 'retailers'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              aria-expanded={summaryOpen}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
            >
              Order summary
              <ChevronUp className={`size-4 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </footer>
      )}

      {/* pinned 3D scene preview (T11) — click to open the Preview tab */}
      {pinnedPreviewUrl ? (
        <button
          type="button"
          onClick={onOpenPreview}
          title="Open the 3D preview"
          className="group absolute bottom-24 right-4 z-10 hidden lg:block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pinnedPreviewUrl}
            alt="Pinned 3D scene preview"
            className="size-16 rounded-2xl object-cover shadow-lg ring-2 ring-[#D9623B]/40 transition-transform group-hover:scale-105"
          />
          <span className="mt-1 block text-center text-[10px] font-medium text-muted-foreground">
            Scene preview
          </span>
        </button>
      ) : null}
    </div>
  )
}