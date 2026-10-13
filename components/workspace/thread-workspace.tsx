'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useChat, type UIMessage } from '@tanstack/ai-react'

import {
  mergeBoard,
  readLatestPlan,
  toViewMessages,
  type LooseMessage,
} from '@/lib/workspace/agent-plan'
import { BoardPanel } from './board-panel'
import { ChatPanel } from './chat-panel'
import { createNakamiConnection } from '@/lib/workspace/nakami-connection'
import type { SceneItem } from '@/components/workspace/scene-3d'
import { useJobs } from '@/lib/workspace/use-jobs'
import { emptyBoard, swapTo, type Board, type Category } from '@/types/workspaces'

type Props = {
  threadId: string
  /** The prompt the thread was created with (threads.first_prompt). */
  firstPrompt?: string | null
  /** Chat history loaded from Supabase by the page (server side). */
  initialMessages?: UIMessage[]
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

function WorkspaceInner({ threadId, firstPrompt, initialMessages = [] }: Props) {
  const [board, setBoard] = useState<Board>(emptyBoard)
  const [category, setCategory] = useState<Category>('furniture')
  const [tab, setTab] = useState<'chat' | 'board'>('chat')
  const [workedFor, setWorkedFor] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const connection = useMemo(() => createNakamiConnection(threadId), [threadId])

  const { messages, sendMessage, isLoading, error, stop, reload } = useChat({
    connection,
    threadId,
    initialMessages,
  })

  const { byProduct, generate, generating, generateError } = useJobs(threadId)

  // Always-current copies for callbacks and effects.
  const boardRef = useRef(board)
  const categoryRef = useRef(category)
  const messagesRef = useRef(messages)
  const startedRef = useRef(false)
  const runStartRef = useRef<number | null>(null)
  const boardMessageRef = useRef<string | null>(null)
  boardRef.current = board
  categoryRef.current = category
  messagesRef.current = messages

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

  const loose = messages as unknown as LooseMessage[]

  const viewMessages = useMemo(
    () => toViewMessages(loose, { workedFor, running: isLoading, fallback: category }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, workedFor, isLoading, category]
  )

  const latestPlan = useMemo(
    () => readLatestPlan(loose, categoryRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages]
  )

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

  async function handleGenerate(slots?: string[]) {
    const wanted = new Set(slots ?? selectedSlots)
    const targets = board.products.filter((p) => wanted.has(p.slot))

    await generate(
      targets.map((p) => ({ productId: p.id, imageUrl: p.imageUrl, prompt: p.name }))
    )
  }

  // Models for the 3D scene: the selected products (or all, if none selected) that are ready.
  const sceneItems: SceneItem[] = useMemo(() => {
    const scope =
      selectedSlots.size > 0 ? board.products.filter((p) => selectedSlots.has(p.slot)) : board.products

    return scope.flatMap((p) => {
      const job = byProduct.get(p.id)
      return job?.status === 'ready' && job.assetUrl
        ? [{ id: p.id, name: p.name, url: job.assetUrl }]
        : []
    })
  }, [board.products, selectedSlots, byProduct])

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
        {(['chat', 'board'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 ${
              tab === value ? 'bg-foreground text-background' : 'text-foreground/60'
            }`}
          >
            {value === 'chat' ? 'Chat' : `Board${itemCount ? ` (${itemCount})` : ''}`}
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
          tab === 'board' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <BoardPanel
          board={board}
          running={isLoading}
          selected={selectedSlots}
          jobs={byProduct}
          generating={generating}
          generateError={generateError}
          sceneItems={sceneItems}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onGenerate={handleGenerate}
          onSwap={handleSwap}
          onToggleLock={handleToggleLock}
          onRemove={handleRemove}
        />
      </section>
    </div>
  )
}