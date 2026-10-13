'use client'

// components/workspace/thread-workspace.tsx
//
// T7: the thread workspace shell. A working tab bar — Chat / Products /
// Preview — with the active tab synced to the URL (?tab=chat|board|preview) so
// a reload or shared link lands on the same view, and a slot for the
// PreviewTab content (T11).
//
// URL sync: reads the initial tab through useSearchParams (SSR-safe), then
// writes with history.replaceState — a pure client-side query swap, so
// switching tabs never triggers a server round-trip.
//
// The Preview tab is fed by two pieces of derived state:
// - the scene layout read from the persisted build_scene_layout tool call
//   (reload-safe, see lib/workspace/scene-plan.ts)
// - per-product job status from the Realtime jobs subscription (T10)

import { useEffect, useMemo, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useChat, type UIMessage } from '@tanstack/ai-react'
import { usePathname, useSearchParams } from 'next/navigation'

import {
  mergeBoard,
  readLatestPlan,
  toViewMessages,
  type LooseMessage,
} from '@/lib/workspace/agent-plan'
import { readLatestSceneLayout } from '@/lib/workspace/scene-plan'
import { BoardPanel } from './board-panel'
import { ChatPanel } from './chat-panel'
import { PreviewTab, type PreviewItem } from './preview-tab'
import { createNakamiConnection } from '@/lib/workspace/nakami-connection'
import { useJobs, type GenerateItem } from '@/lib/workspace/use-jobs'
import { emptyBoard, swapTo, type Board, type Category } from '@/types/workspaces'

type Props = {
  threadId: string
  /** The prompt the thread was created with (threads.first_prompt). */
  firstPrompt?: string | null
  /** Pinned preview capture (threads.preview_image_url), if any. */
  initialPreviewUrl?: string | null
  /** Chat history loaded from Supabase by the page (server side). */
  initialMessages?: UIMessage[]
}

type Tab = 'chat' | 'board' | 'preview'

const TAB_VALUES: Tab[] = ['chat', 'board', 'preview']

function parseTab(value: string | null): Tab {
  return value === 'board' || value === 'preview' ? value : 'chat'
}

// If your app already has a QueryClientProvider, delete this wrapper and render <WorkspaceInner /> directly.
export function ThreadWorkspace(props: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      })
  )

  return (
    <QueryClientProvider client={client}>
      <WorkspaceInner {...props} />
    </QueryClientProvider>
  )
}

function WorkspaceInner({
  threadId,
  firstPrompt,
  initialPreviewUrl = null,
  initialMessages = [],
}: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [board, setBoard] = useState<Board>(emptyBoard)
  const [category, setCategory] = useState<Category>('furniture')
  const [tab, setTabState] = useState<Tab>(() => parseTab(searchParams.get('tab')))
  const [workedFor, setWorkedFor] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sceneSelection, setSceneSelection] = useState<string | null>(null)
  const [pinnedPreview, setPinnedPreview] = useState<string | null>(initialPreviewUrl)

  const connection = useMemo(() => createNakamiConnection(threadId), [threadId])

  const { messages, sendMessage, isLoading, error, stop, reload } = useChat({
    connection,
    threadId,
    initialMessages,
  })

  const { byProduct, generate, generating, generateError } = useJobs(threadId)

  // Always-current copies for callbacks and effects. React's ref rule forbids
  // writing refs during render, so the mirrors sync in an effect; it is
  // declared before every consumer so it runs first after each commit.
  const boardRef = useRef(board)
  const categoryRef = useRef(category)
  const messagesRef = useRef(messages)
  const startedRef = useRef(false)
  const runStartRef = useRef<number | null>(null)
  const boardMessageRef = useRef<string | null>(null)

  useEffect(() => {
    boardRef.current = board
    categoryRef.current = category
    messagesRef.current = messages
  }, [board, category, messages])

  /** Set the tab and mirror it into the URL without a server round-trip. */
  function setTab(next: Tab) {
    setTabState(next)
    window.history.replaceState(
      null,
      '',
      `${pathname}${next === 'chat' ? '' : `?tab=${next}`}`
    )
  }

  function send(text: string) {
    const value = text.trim()
    if (!value) return

    const locked = boardRef.current.products
      .filter((p) => p.locked)
      .map((p) => ({ slot: p.slot, name: p.name }))

    // `body` rides along as forwardedProps; nakami-connection.ts reshapes it
    // into the { threadId, message } your /api/chat route expects.
    void sendMessage(value, {
      body: { message: value, category: categoryRef.current, locked },
    })
  }

  // First visit: run the prompt the thread was created with.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const key = `nakami:pending-prompt:${threadId}`
    const stored = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)

    if (initialMessages.length > 0) return

    const prompt = firstPrompt?.trim() || stored
    if (prompt) send(prompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Record how long each run took ("Worked for 29s").
  useEffect(() => {
    if (isLoading) {
      if (runStartRef.current === null) runStartRef.current = performance.now()
      return
    }
    if (runStartRef.current === null) return

    const seconds = Math.max(1, Math.round((performance.now() - runStartRef.current) / 1000))
    runStartRef.current = null

    const lastAssistant = [...messagesRef.current].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant) {
      setWorkedFor((w) => ({ ...w, [lastAssistant.id]: seconds }))
    }
  }, [isLoading])

  /* Derive chat + board from what the agent streams */

  const loose = useMemo(() => messages as unknown as LooseMessage[], [messages])

  const viewMessages = useMemo(
    () => toViewMessages(loose, { workedFor, running: isLoading, fallback: category }),
    [loose, workedFor, isLoading, category]
  )

  const latestPlan = useMemo(() => readLatestPlan(loose, category), [loose, category])

  // Mirror the latest plan into editable board state. Products appear one by one
  // while the structured JSON streams; locked items are preserved.
  useEffect(() => {
    if (!latestPlan) return

    const prev = boardRef.current
    const isNewRun =
      boardMessageRef.current !== null && boardMessageRef.current !== latestPlan.messageId

    // A follow-up starts with only a few products streamed in. Keep the current
    // board until the new plan catches up so it doesn't collapse and refill.
    const holding =
      isNewRun && !latestPlan.complete && latestPlan.board.products.length < prev.products.length
    if (holding) return

    boardMessageRef.current = latestPlan.messageId
    setBoard(mergeBoard(prev, latestPlan.board))
  }, [latestPlan])

  /* Preview scene (T10) */

  // The layout the agent produced — read from the persisted tool call, so a
  // reload restores the same scene.
  const layout = useMemo(() => readLatestSceneLayout(loose), [loose])

  const productById = useMemo(
    () => new Map(board.products.map((p) => [p.id, p])),
    [board.products]
  )

  const previewItems = useMemo<PreviewItem[]>(() => {
    if (!layout) return []
    return layout.items.flatMap((placement) => {
      const product = productById.get(placement.productId)
      if (!product) return []
      const job = byProduct.get(placement.productId) ?? null
      return [
        {
          productId: placement.productId,
          name: product.name,
          imageUrl: product.imageUrl ?? null,
          glbUrl: job?.status === 'ready' && job.assetUrl ? job.assetUrl : null,
          job,
        },
      ]
    })
  }, [layout, productById, byProduct])

  /* Selection (only slots that still exist) */

  const selectedSlots = useMemo(
    () => new Set([...selected].filter((slot) => board.products.some((p) => p.slot === slot))),
    [selected, board.products]
  )

  const toggleSelect = (slot: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })

  const selectAll = () => setSelected(new Set(board.products.map((p) => p.slot)))
  const clearSelection = () => setSelected(new Set())

  /* 3D generation */

  /** Queue jobs for the given board slots (or for everything on the board). */
  async function handleGenerate(slots?: string[]) {
    const wanted = slots ? new Set(slots) : null
    const targets = boardRef.current.products.filter(
      (p) => !wanted || wanted.has(p.slot)
    )
    if (targets.length === 0) return

    // Jump to the scene right away; placeholders appear while models generate.
    setTab('preview')
    await generate(targets.map((p) => ({ productId: p.id, imageUrl: p.imageUrl, prompt: p.name })))
  }

  /** Preview tab: generate every placed product that has no finished job. */
  function handlePreviewGenerate() {
    void generate(
      previewItems.map((item) => ({
        productId: item.productId,
        imageUrl: item.imageUrl ?? undefined,
        prompt: item.name,
      }))
    )
  }

  function handlePreviewRetry(productId: string) {
    const item = previewItems.find((i) => i.productId === productId)
    if (!item) return
    const payload: GenerateItem = {
      productId: item.productId,
      prompt: item.name,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    }
    void generate([payload])
  }

  /* Board actions (local; locked items are sent to the agent on the next message) */

  function updateProducts(fn: (products: Board['products']) => Board['products']) {
    setBoard((b) => ({ ...b, products: fn(b.products) }))
  }

  const handleSwap = (slot: string, altId: string) =>
    updateProducts((ps) => ps.map((p) => (p.slot === slot ? swapTo(p, altId) : p)))

  const handleToggleLock = (slot: string) =>
    updateProducts((ps) => ps.map((p) => (p.slot === slot ? { ...p, locked: !p.locked } : p)))

  const handleRemove = (slot: string) => updateProducts((ps) => ps.filter((p) => p.slot !== slot))

  const itemCount = board.products.length

  return (
    <div className="flex h-[calc(100svh-4rem)] flex-col overflow-hidden lg:flex-row">
      {/* mobile tab switcher */}
      <div
        role="group"
        aria-label="Workspace view"
        className="flex shrink-0 gap-1 border-b border-border bg-background p-2 lg:hidden"
      >
        {TAB_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 ${
              tab === value ? 'bg-foreground text-background' : 'text-foreground/60'
            }`}
          >
            {value === 'chat'
              ? 'Chat'
              : value === 'board'
                ? `Products${itemCount ? ` (${itemCount})` : ''}`
                : 'Preview'}
          </button>
        ))}
      </div>

      <section
        className={`min-h-0 flex-1 flex-col lg:w-[400px] lg:flex-none lg:border-r lg:border-border xl:w-[440px] ${
          tab === 'chat' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <ChatPanel
          messages={viewMessages}
          running={isLoading}
          error={error ? 'Something went wrong while building your board.' : null}
          category={category}
          onCategoryChange={setCategory}
          onSend={send}
          onStop={() => stop()}
          onRetry={() => void reload()}
          onShowBoard={() => setTab('board')}
        />
      </section>

      <section
        className={`min-h-0 min-w-0 flex-1 flex-col ${
          tab === 'chat' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* desktop view switcher (the mobile bar above covers all three) */}
        <div className="hidden shrink-0 items-center justify-end gap-2 border-b border-border bg-background px-6 py-2.5 lg:flex">
          <div className="flex rounded-full bg-muted p-1">
            {(['board', 'preview'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={`rounded-full px-3.5 py-1.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 ${
                  tab === value || (value === 'board' && tab === 'chat')
                    ? 'bg-background font-medium shadow-sm'
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                {value === 'board' ? 'Products' : 'Preview'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'preview' ? (
          <PreviewTab
            threadId={threadId}
            layout={layout}
            items={previewItems}
            generating={generating}
            generateError={generateError}
            selectedProductId={sceneSelection}
            pinnedPreviewUrl={pinnedPreview}
            onSelectItem={(productId) =>
              setSceneSelection((prev) => (prev === productId ? null : productId))
            }
            onGenerateAll={handlePreviewGenerate}
            onRetryItem={handlePreviewRetry}
            onPinnedChange={setPinnedPreview}
            onGoToBoard={() => setTab('board')}
            onGoToChat={() => setTab('chat')}
          />
        ) : (
          <BoardPanel
            board={board}
            running={isLoading}
            selected={selectedSlots}
            jobs={byProduct}
            generating={generating}
            generateError={generateError}
            pinnedPreviewUrl={pinnedPreview}
            onOpenPreview={() => setTab('preview')}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onGenerate={handleGenerate}
            onSwap={handleSwap}
            onToggleLock={handleToggleLock}
            onRemove={handleRemove}
          />
        )}
      </section>
    </div>
  )
}
