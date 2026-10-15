'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'
import {
  Camera,
  Loader2,
  MessagesSquare,
  RotateCw,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'

import type { SceneLayout } from '@/lib/scene/contract'
import type { Job } from '@/lib/workspace/use-jobs'
import type { CanvasCapture, SceneEntry } from './scene-canvas'

const SceneCanvas = dynamic(() => import('@/components/workspace/scene-canvas'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-foreground/60">
      Loading scene…
    </div>
  ),
})

export type PreviewItem = {
  productId: string
  name: string
  imageUrl: string | null
  glbUrl: string | null
  job: Job | null
}

type Props = {
  threadId: string
  layout: SceneLayout | null
  items: PreviewItem[]
  /** True while a generate request is in flight (used for button spinners). */
  generating: boolean
  generateError: string | null
  selectedProductId: string | null
  pinnedPreviewUrl: string | null
  onSelectItem: (productId: string | null) => void
  onGenerateAll: () => void
  onRetryItem: (productId: string) => void
  onPinnedChange: (url: string | null) => void
  onGoToBoard: () => void
  onGoToChat: () => void
}

export function PreviewTab({
  threadId,
  layout,
  items,
  generating,
  generateError,
  selectedProductId,
  pinnedPreviewUrl,
  onSelectItem,
  onGenerateAll,
  onRetryItem,
  onPinnedChange,
  onGoToBoard,
  onGoToChat,
}: Props) {
  const captureRef = useRef<CanvasCapture | null>(null)
  const handleCaptureReady = useCallback((capture: CanvasCapture) => {
    captureRef.current = capture
  }, [])

  // Empty state: the agent has not laid out the space yet.
  if (!layout) {
    return (
      <EmptyScene
        icon={<MessagesSquare className="size-5 text-[#D9623B]" />}
        title="Your 3D scene appears here"
        description="Describe your space in the chat — once the agent places products, they show up in this room."
        action={
          <button
            type="button"
            onClick={onGoToChat}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Go to chat
          </button>
        }
      />
    )
  }

  // The layout references products that are no longer on the board.
  if (items.length === 0) {
    return (
      <EmptyScene
        icon={<Sparkles className="size-5 text-[#D9623B]" />}
        title="No products to place"
        description="The layout references products you removed from the board. Add them back and the scene rebuilds."
        action={
          <button
            type="button"
            onClick={onGoToBoard}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Go to products
          </button>
        }
      />
    )
  }

  const entries: SceneEntry[] = items.map((item) => ({
    productId: item.productId,
    imageUrl: item.imageUrl,
    glbUrl: item.glbUrl,
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
        {generateError ? (
          <div className="flex items-center gap-2 rounded-2xl bg-[#F8E9E7] px-4 py-2.5 text-sm text-[#B44B33]">
            <TriangleAlert className="size-4 shrink-0" />
            <span>{generateError}</span>
          </div>
        ) : null}

        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-3xl border border-border bg-[#F1EBDF]">
          <SceneCanvas
            layout={layout}
            entries={entries}
            selectedProductId={selectedProductId}
            onSelect={onSelectItem}
            onCaptureReady={handleCaptureReady}
          />

          <SceneGeneratingOverlay
            items={items}
            generating={generating}
            onGenerateAll={onGenerateAll}
            onRetryItem={onRetryItem}
          />

          <SceneCornerThumb
            threadId={threadId}
            captureRef={captureRef}
            url={pinnedPreviewUrl}
            onPinned={onPinnedChange}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Drag to orbit · scroll to zoom · click a product to highlight it
        </p>
      </div>
    </div>
  )
}

/**
 * SceneGeneratingOverlay — T11. Shows nothing once every job is ready and
 * nothing has failed; otherwise the per-product chips (with the generate-all
 * CTA before any job exists, retry buttons on failures).
 */
function SceneGeneratingOverlay({
  items,
  generating,
  onGenerateAll,
  onRetryItem,
}: {
  items: PreviewItem[]
  generating: boolean
  onGenerateAll: () => void
  onRetryItem: (productId: string) => void
}) {
  const pending = items.filter(
    (item) => item.job && item.job.status !== 'ready',
  )
  const active = pending.filter(
    (item) => item.job && item.job.status !== 'failed',
  )
  const failed = pending.filter((item) => item.job?.status === 'failed')
  const started = items.some((item) => item.job)
  const allReady = items.every(
    (item) => !item.job || item.job.status === 'ready',
  )

  // Nothing started yet: the big CTA card.
  if (!started && !generating) {
    return (
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-3xl bg-white/90 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
          <div className="grid size-11 place-items-center rounded-full bg-[#F7E7DF]">
            <Sparkles className="size-5 text-[#D9623B]" />
          </div>
          <div>
            <p className="font-medium">See it in 3D</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate 3D models for the {items.length}{' '}
              {items.length === 1 ? 'product' : 'products'} in this scene.
            </p>
          </div>
          <button
            type="button"
            onClick={onGenerateAll}
            className="flex items-center gap-2 rounded-full bg-[#D9623B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Generate 3D scene
          </button>
        </div>
      </div>
    )
  }

  if (allReady && pending.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3">
      {active.length > 0 ? (
        <div className="flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm">
          <Loader2 className="size-3.5 animate-spin text-[#D9623B]" />
          Generating 3D —{' '}
          {items.length - pending.length}/{items.length} ready
        </div>
      ) : null}

      {failed.length > 0 && active.length === 0 ? (
        <div className="flex items-center gap-2 rounded-full bg-[#F8E9E7]/90 px-3.5 py-1.5 text-xs font-medium text-[#B44B33] shadow-sm backdrop-blur-sm">
          <TriangleAlert className="size-3.5" />
          Some models failed to generate
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-2">
          {pending.map((item) => {
            const job = item.job!
            return (
              <div
                key={item.productId}
                className="flex items-center gap-1.5 rounded-full bg-white/90 py-1.5 pl-2.5 pr-2 text-xs shadow-sm backdrop-blur-sm"
              >
                {job.status === 'failed' ? (
                  <TriangleAlert className="size-3.5 shrink-0 text-[#B44B33]" />
                ) : (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-[#D9623B]" />
                )}
                <span className="max-w-40 truncate font-medium">
                  {item.name}
                </span>
                {job.status === 'failed' ? (
                  <button
                    type="button"
                    onClick={() => onRetryItem(item.productId)}
                    disabled={generating}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background disabled:opacity-50"
                  >
                    <RotateCw className="size-3" />
                    Retry
                  </button>
                ) : (
                  <span className="shrink-0 pr-1 text-[11px] text-muted-foreground">
                    {job.status === 'queued' ? 'Queued' : 'Modeling'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * SceneCornerThumb — T11. The small button pinned to the canvas corner that
 * captures the current frame and uploads it via the preview-image route.
 * Shows the pinned image once present (hover actions: re-pin, un-pin).
 */
function SceneCornerThumb({
  threadId,
  captureRef,
  url,
  onPinned,
}: {
  threadId: string
  captureRef: React.RefObject<CanvasCapture | null>
  url: string | null
  onPinned: (url: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function pin() {
    const capture = captureRef.current
    if (!capture || busy) return

    const dataUrl = capture()
    if (!dataUrl) {
      setFailed(true)
      return
    }

    setBusy(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/threads/${threadId}/preview-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      const body: unknown = await res.json().catch(() => null)
      const pinned =
        body !== null &&
        typeof body === 'object' &&
        typeof (body as { url?: unknown }).url === 'string'
          ? (body as { url: string }).url
          : null
      if (res.ok && pinned) {
        onPinned(pinned)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  async function unpin() {
    if (busy) return
    setBusy(true)
    try {
      await fetch(`/api/threads/${threadId}/preview-image`, {
        method: 'DELETE',
      })
      onPinned(null)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (url) {
    return (
      <div className="group absolute bottom-3 right-3 flex items-end gap-1.5">
        <button
          type="button"
          onClick={pin}
          disabled={busy}
          title="Refresh the pinned preview"
          className="relative overflow-hidden rounded-2xl shadow-lg ring-2 ring-[#D9623B]/50 transition-transform hover:scale-[1.03] disabled:opacity-60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Pinned 3D scene preview"
            className="size-16 object-cover"
          />
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2 className="size-4 animate-spin text-white" />
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={unpin}
          disabled={busy}
          title="Un-pin the preview"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="group absolute bottom-3 right-3">
      <button
        type="button"
        onClick={pin}
        disabled={busy}
        title="Pin a preview of this scene"
        className="relative flex size-11 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin text-foreground" />
        ) : (
          <Camera className="size-4 text-foreground" />
        )}
      </button>
      {failed ? (
        <span className="absolute -bottom-5 right-0 text-[10px] font-medium text-[#B44B33]">
          Capture failed
        </span>
      ) : null}
    </div>
  )
}

function EmptyScene({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border bg-[#F1EBDF]/40">
          <div className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <div className="grid size-11 place-items-center rounded-full bg-[#F7E7DF]">
              {icon}
            </div>
            <div>
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            {action}
          </div>
        </div>
      </div>
    </div>
  )
}
