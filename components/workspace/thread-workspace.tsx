"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fetchServerSentEvents,
  useChat,
  type UIMessage,
} from "@tanstack/ai-react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  mergeBoard,
  readLatestPlan,
  toViewMessages,
  type LooseMessage,
} from "@/lib/workspace/agent-plan";
import { readLatestSceneLayout } from "@/lib/workspace/scene-plan";
import { BoardPanel } from "./board-panel";
import { ChatPanel } from "./chat-panel";
import { PreviewTab, type PreviewItem } from "./preview-tab";
import { useJobs, type GenerateItem } from "@/lib/workspace/use-jobs";
import {
  emptyBoard,
  swapTo,
  type Board,
  type Category,
} from "@/types/workspaces";

import {
  MessageSquare,
  LayoutGrid,
  ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  Sparkles,
} from "lucide-react";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  threadId: string;
  /** The prompt the thread was created with (threads.first_prompt). */
  firstPrompt?: string | null;
  /** Pinned preview capture (threads.preview_image_url), if any. */
  initialPreviewUrl?: string | null;
};

type Tab = "chat" | "board" | "preview";

const TAB_VALUES: Tab[] = ["chat", "board", "preview"];

function parseTab(value: string | null): Tab {
  return value === "board" || value === "preview" ? value : "chat";
}

// If your app already has a QueryClientProvider, delete this wrapper and render <WorkspaceInner /> directly.
export function ThreadWorkspace(props: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <WorkspaceInner {...props} />
    </QueryClientProvider>
  );
}

function WorkspaceInner({
  threadId,
  firstPrompt,
  initialPreviewUrl = null,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [board, setBoard] = useState<Board>(emptyBoard);
  const [category, setCategory] = useState<Category>("furniture");
  const [tab, setTabState] = useState<Tab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [workedFor, setWorkedFor] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sceneSelection, setSceneSelection] = useState<string | null>(null);
  const [pinnedPreview, setPinnedPreview] = useState<string | null>(
    initialPreviewUrl,
  );
  const [chatVisible, setChatVisible] = useState(true);

  const { messages, sendMessage, isLoading, error, stop, reload } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
    threadId,
    persistence: true,
  });

  const { byProduct, generate, generating, generateError } = useJobs(threadId);

  // Always-current copies for callbacks and effects. React's ref rule forbids
  // writing refs during render, so the mirrors sync in an effect; it is
  // declared before every consumer so it runs first after each commit.
  const boardRef = useRef(board);
  const categoryRef = useRef(category);
  const messagesRef = useRef(messages);
  const startedRef = useRef(false);
  const runStartRef = useRef<number | null>(null);
  const boardMessageRef = useRef<string | null>(null);

  useEffect(() => {
    boardRef.current = board;
    categoryRef.current = category;
    messagesRef.current = messages;
  }, [board, category, messages]);

  /** Set the tab and mirror it into the URL without a server round-trip. */
  function setTab(next: Tab) {
    setTabState(next);
    window.history.replaceState(
      null,
      "",
      `${pathname}${next === "chat" ? "" : `?tab=${next}`}`,
    );
  }

  function send(text: string) {
    const value = text.trim();
    if (!value) return;

    void sendMessage(value);
  }

  // First visit: run the prompt the thread was created with.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const key = `nakami:pending-prompt:${threadId}`;
    const stored = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);

    const prompt = firstPrompt?.trim() || stored;
    if (prompt) send(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record how long each run took ("Worked for 29s").
  useEffect(() => {
    if (isLoading) {
      if (runStartRef.current === null) runStartRef.current = performance.now();
      return;
    }
    if (runStartRef.current === null) return;

    const seconds = Math.max(
      1,
      Math.round((performance.now() - runStartRef.current) / 1000),
    );
    runStartRef.current = null;

    const lastAssistant = [...messagesRef.current]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistant) {
      setWorkedFor((w) => ({ ...w, [lastAssistant.id]: seconds }));
    }
  }, [isLoading]);

  /* Derive chat + board from what the agent streams */

  const loose = useMemo(
    () => messages as unknown as LooseMessage[],
    [messages],
  );

  const viewMessages = useMemo(
    () =>
      toViewMessages(loose, {
        workedFor,
        running: isLoading,
        fallback: category,
      }),
    [loose, workedFor, isLoading, category],
  );

  const latestPlan = useMemo(
    () => readLatestPlan(loose, category),
    [loose, category],
  );

  // Mirror the latest plan into editable board state. Products appear one by one
  // while the structured JSON streams; locked items are preserved.
  useEffect(() => {
    if (!latestPlan) return;

    const prev = boardRef.current;
    const isNewRun =
      boardMessageRef.current !== null &&
      boardMessageRef.current !== latestPlan.messageId;

    // A follow-up starts with only a few products streamed in. Keep the current
    // board until the new plan catches up so it doesn't collapse and refill.
    const holding =
      isNewRun &&
      !latestPlan.complete &&
      latestPlan.board.products.length < prev.products.length;
    if (holding) return;

    boardMessageRef.current = latestPlan.messageId;
    setBoard(mergeBoard(prev, latestPlan.board));
  }, [latestPlan]);

  /* Preview scene (T10) */

  // The layout the agent produced — read from the persisted tool call, so a
  // reload restores the same scene.
  const layout = useMemo(() => readLatestSceneLayout(loose), [loose]);

  const productById = useMemo(
    () => new Map(board.products.map((p) => [p.id, p])),
    [board.products],
  );

  const previewItems = useMemo<PreviewItem[]>(() => {
    if (!layout) return [];
    return layout.items.flatMap((placement) => {
      const product = productById.get(placement.productId);
      if (!product) return [];
      const job = byProduct.get(placement.productId) ?? null;
      return [
        {
          productId: placement.productId,
          name: product.name,
          imageUrl: product.imageUrl ?? null,
          glbUrl: job?.status === "ready" && job.assetUrl ? job.assetUrl : null,
          job,
        },
      ];
    });
  }, [layout, productById, byProduct]);

  /* Selection (only slots that still exist) */

  const selectedSlots = useMemo(
    () =>
      new Set(
        [...selected].filter((slot) =>
          board.products.some((p) => p.slot === slot),
        ),
      ),
    [selected, board.products],
  );

  const toggleSelect = (slot: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });

  const selectAll = () =>
    setSelected(new Set(board.products.map((p) => p.slot)));
  const clearSelection = () => setSelected(new Set());

  /* 3D generation */

  /** Queue jobs for the given board slots (or for everything on the board). */
  async function handleGenerate(slots?: string[]) {
    const wanted = slots ? new Set(slots) : null;
    const targets = boardRef.current.products.filter(
      (p) => !wanted || wanted.has(p.slot),
    );
    if (targets.length === 0) return;

    // Jump to the scene right away; placeholders appear while models generate.
    setTab("preview");
    await generate(
      targets.map((p) => ({
        productId: p.id,
        imageUrl: p.imageUrl,
        prompt: p.name,
      })),
    );
  }

  /** Preview tab: generate every placed product that has no finished job. */
  function handlePreviewGenerate() {
    void generate(
      previewItems.map((item) => ({
        productId: item.productId,
        imageUrl: item.imageUrl ?? undefined,
        prompt: item.name,
      })),
    );
  }

  function handlePreviewRetry(productId: string) {
    const item = previewItems.find((i) => i.productId === productId);
    if (!item) return;
    const payload: GenerateItem = {
      productId: item.productId,
      prompt: item.name,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    };
    void generate([payload]);
  }

  /* Board actions (local; locked items are sent to the agent on the next message) */

  function updateProducts(
    fn: (products: Board["products"]) => Board["products"],
  ) {
    setBoard((b) => ({ ...b, products: fn(b.products) }));
  }

  const handleSwap = (slot: string, altId: string) =>
    updateProducts((ps) =>
      ps.map((p) => (p.slot === slot ? swapTo(p, altId) : p)),
    );

  const handleToggleLock = (slot: string) =>
    updateProducts((ps) =>
      ps.map((p) => (p.slot === slot ? { ...p, locked: !p.locked } : p)),
    );

  const handleRemove = (slot: string) =>
    updateProducts((ps) => ps.filter((p) => p.slot !== slot));

  const itemCount = board.products.length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      {/* MOBILE NAVIGATION */}
      <div className="flex shrink-0 border-b bg-background p-2 lg:hidden">
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {TAB_VALUES.map((value) => {
            const Icon =
              value === "chat"
                ? MessageSquare
                : value === "board"
                  ? LayoutGrid
                  : ImageIcon;

            const label =
              value === "chat"
                ? "Chat"
                : value === "board"
                  ? "Products"
                  : "Preview";

            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={`
                flex min-w-0 items-center justify-center gap-2
                rounded-lg px-2 py-2.5 text-sm font-medium
                transition-all duration-200
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-primary/40
                ${
                  tab === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
              >
                <Icon className="size-4 shrink-0" />

                <span className="truncate">{label}</span>

                {value === "board" && itemCount > 0 && (
                  <span className="hidden rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary sm:inline">
                    {itemCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP WORKSPACE */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full min-h-0 w-full"
        >
          {/* CHAT PANEL */}
          {chatVisible && (
            <>
              <ResizablePanel defaultSize="32%" minSize="300px" maxSize="50%">
                <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
                  {/* CHAT HEADER */}
                  <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                        <Sparkles className="size-4 text-primary" />
                      </div>

                      <div>
                        <h2 className="text-sm font-semibold">Nakami AI</h2>

                        <p className="text-xs text-muted-foreground">
                          Your shopping assistant
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLoading && (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setChatVisible(false)}
                        aria-label="Collapse chat panel"
                        title="Collapse chat"
                        className="size-8"
                      >
                        <PanelLeftClose className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* EXISTING CHAT COMPONENT */}
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <ChatPanel
                      messages={viewMessages}
                      running={isLoading}
                      error={
                        error
                          ? "Something went wrong while building your board."
                          : null
                      }
                      category={category}
                      onCategoryChange={setCategory}
                      onSend={send}
                      onStop={() => stop()}
                      onRetry={() => void reload()}
                      onShowBoard={() => setTab("board")}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel
            defaultSize={chatVisible ? "68%" : "100%"}
            minSize="50%"
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {/* WORKSPACE TOOLBAR */}
              <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
                {/* LEFT */}
                <div className="flex min-w-0 items-center gap-3">
                  {!chatVisible && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setChatVisible(true)}
                      aria-label="Expand chat panel"
                      title="Expand chat"
                      className="size-8 shrink-0"
                    >
                      <PanelLeftOpen className="size-4" />
                    </Button>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="hidden text-sm font-semibold xl:inline">
                      Shopping Workspace
                    </span>

                    <Badge variant="secondary" className="shrink-0">
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </Badge>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="flex items-center gap-3">
                  {/* GENERATION STATUS */}
                  {generating && (
                    <div className="hidden items-center gap-2 text-xs text-muted-foreground xl:flex">
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                      Generating preview
                    </div>
                  )}

                  {/* VIEW SWITCHER */}
                  <div
                    role="group"
                    aria-label="Shopping workspace view"
                    className="flex items-center rounded-lg bg-muted p-1"
                  >
                    <button
                      type="button"
                      onClick={() => setTab("board")}
                      aria-pressed={tab !== "preview"}
                      className={`
                      flex items-center gap-2 rounded-md
                      px-3 py-1.5 text-sm font-medium
                      transition-all
                      focus-visible:outline-none
                      focus-visible:ring-2 focus-visible:ring-primary/40
                      ${
                        tab !== "preview"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                    >
                      <LayoutGrid className="size-4" />
                      Products
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab("preview")}
                      aria-pressed={tab === "preview"}
                      className={`
                      flex items-center gap-2 rounded-md
                      px-3 py-1.5 text-sm font-medium
                      transition-all
                      focus-visible:outline-none
                      focus-visible:ring-2 focus-visible:ring-primary/40
                      ${
                        tab === "preview"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                    >
                      <ImageIcon className="size-4" />
                      Preview
                    </button>
                  </div>
                </div>
              </div>

              {/* PRODUCTS / PREVIEW CONTENT */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {tab === "preview" ? (
                  <PreviewTab
                    threadId={threadId}
                    layout={layout}
                    items={previewItems}
                    generating={generating}
                    generateError={generateError}
                    selectedProductId={sceneSelection}
                    pinnedPreviewUrl={pinnedPreview}
                    onSelectItem={(productId) =>
                      setSceneSelection((prev) =>
                        prev === productId ? null : productId,
                      )
                    }
                    onGenerateAll={handlePreviewGenerate}
                    onRetryItem={handlePreviewRetry}
                    onPinnedChange={setPinnedPreview}
                    onGoToBoard={() => setTab("board")}
                    onGoToChat={() => setTab("chat")}
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
                    onOpenPreview={() => setTab("preview")}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    onClearSelection={clearSelection}
                    onGenerate={handleGenerate}
                    onSwap={handleSwap}
                    onToggleLock={handleToggleLock}
                    onRemove={handleRemove}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* MOBILE WORKSPACE */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        {/* CHAT */}
        <div
          className={`min-h-0 flex-1 overflow-hidden ${
            tab === "chat" ? "flex flex-col" : "hidden"
          }`}
        >
          <ChatPanel
            messages={viewMessages}
            running={isLoading}
            error={
              error ? "Something went wrong while building your board." : null
            }
            category={category}
            onCategoryChange={setCategory}
            onSend={send}
            onStop={() => stop()}
            onRetry={() => void reload()}
            onShowBoard={() => setTab("board")}
          />
        </div>

        {/* PRODUCTS */}
        <div
          className={`min-h-0 flex-1 overflow-hidden ${
            tab === "board" ? "flex flex-col" : "hidden"
          }`}
        >
          <BoardPanel
            board={board}
            running={isLoading}
            selected={selectedSlots}
            jobs={byProduct}
            generating={generating}
            generateError={generateError}
            pinnedPreviewUrl={pinnedPreview}
            onOpenPreview={() => setTab("preview")}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onGenerate={handleGenerate}
            onSwap={handleSwap}
            onToggleLock={handleToggleLock}
            onRemove={handleRemove}
          />
        </div>

        {/* PREVIEW */}
        <div
          className={`min-h-0 flex-1 overflow-hidden ${
            tab === "preview" ? "flex flex-col" : "hidden"
          }`}
        >
          {tab === "preview" && (
            <PreviewTab
              threadId={threadId}
              layout={layout}
              items={previewItems}
              generating={generating}
              generateError={generateError}
              selectedProductId={sceneSelection}
              pinnedPreviewUrl={pinnedPreview}
              onSelectItem={(productId) =>
                setSceneSelection((prev) =>
                  prev === productId ? null : productId,
                )
              }
              onGenerateAll={handlePreviewGenerate}
              onRetryItem={handlePreviewRetry}
              onPinnedChange={setPinnedPreview}
              onGoToBoard={() => setTab("board")}
              onGoToChat={() => setTab("chat")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
