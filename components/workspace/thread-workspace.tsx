"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  mergeBoard,
  readLatestPlan,
  toViewMessages,
  type LooseMessage,
} from "@/lib/workspace/agent-plan";
import { readLatestSceneLayout } from "@/lib/workspace/scene-plan";
import { updateThreadCategory } from "@/lib/api/threads";
import { buildSceneLayout } from "@/lib/scene/layout";
import { estimateDimensionsFromTitles } from "@/lib/agent/dimensions";
import type { SceneLayout } from "@/lib/scene/contract";
import { BoardPanel } from "./board-panel";
import { ChatPanel } from "./chat-panel";
import { PreviewTab, type PreviewItem } from "./preview-tab";
import { useJobs, type GenerateItem } from "@/lib/workspace/use-jobs";
import {
  ordersQueryKey,
  usePurchasedProducts,
} from "@/lib/workspace/use-purchased";

import {
  emptyBoard,
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
  ArrowLeft,
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
  firstPrompt?: string | null;
  initialCategory?: Category;
  initialPreviewUrl?: string | null;
  isNewThread?: boolean;
};

type Tab = "chat" | "board" | "preview";
const TAB_VALUES: Tab[] = ["chat", "board", "preview"];

function parseTab(value: string | null): Tab {
  return value === "board" || value === "preview" ? value : "chat";
}

function BackLink({
  busy,
  iconOnly = false,
}: {
  busy: boolean;
  iconOnly?: boolean;
}) {
  return (
    <Link
      href="/dashboard"
      onClick={(event) => {
        if (
          busy &&
          !window.confirm(
            "The AI is still working on your board. Leave anyway?",
          )
        ) {
          event.preventDefault();
        }
      }}
      aria-label="Back to dashboard"
      title="Back to dashboard"
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 ${
        iconOnly ? "w-8 justify-center" : "px-2"
      }`}
    >
      <ArrowLeft className="size-4" />
      {!iconOnly && <span>Dashboard</span>}
    </Link>
  );
}

/** The board selection stored for this thread (empty during SSR). The board
 *  is empty on first paint either way, so this never changes server-rendered
 *  output — it only kicks in once products stream in. */
function readStoredSelection(threadId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(
      `nakami:scene-selection:${threadId}`,
    );
    const slots: unknown = raw === null ? null : JSON.parse(raw);
    if (!Array.isArray(slots)) return new Set();
    return new Set(
      slots.filter((slot): slot is string => typeof slot === "string"),
    );
  } catch {
    return new Set();
  }
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
  initialCategory = "furniture",
  initialPreviewUrl = null,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { purchasedIds } = usePurchasedProducts();
  const handlePaid = () =>
    void queryClient.invalidateQueries({ queryKey: ordersQueryKey });

  const [board, setBoard] = useState<Board>(emptyBoard);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [tab, setTabState] = useState<Tab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [workedFor, setWorkedFor] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(() =>
    readStoredSelection(threadId),
  );
  const [sceneSelection, setSceneSelection] = useState<string | null>(null);
  const [pinnedPreview, setPinnedPreview] = useState<string | null>(
    initialPreviewUrl,
  );
  const [chatVisible, setChatVisible] = useState(true);

  const { messages, sendMessage, isLoading, isHydrating, error, stop, reload } =
    useChat({
      connection: fetchServerSentEvents("/api/chat"),
      threadId,
      persistence: true,
    });

  const { byProduct, generate, generating, generateError } = useJobs(threadId);

  const boardRef = useRef(board);
  const messagesRef = useRef(messages);
  const startedRef = useRef(false);
  const runStartRef = useRef<number | null>(null);
  const boardMessageRef = useRef<string | null>(null);

  useEffect(() => {
    boardRef.current = board;
    messagesRef.current = messages;
  }, [board, messages]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `nakami:scene-selection:${threadId}`,
        JSON.stringify([...selected]),
      );
    } catch {
      /* storage unavailable — the selection just won't survive a reload */
    }
  }, [selected, threadId]);

  function setTab(next: Tab) {
    setTabState(next);
    window.history.replaceState(
      null,
      "",
      `${pathname}${next === "chat" ? "" : `?tab=${next}`}`,
    );
  }

  const send = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value) return;

      // Carry the current category into forwardedProps so /api/chat can tell
      // the agent whether this is a furniture or gaming board.
      void sendMessage(value, { body: { category } });
    },
    [sendMessage, category],
  );

  function handleCategoryChange(next: Category) {
    setCategory(next);
    // Persist for the next visit; a failed save should not block chatting.
    void updateThreadCategory(threadId, next).catch((error) => {
      console.error("Failed to save the board category:", error);
    });
  }

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

  // First visit: run the prompt the thread was created with.
  useEffect(() => {
    if (startedRef.current || isHydrating) return;
    startedRef.current = true;

    const key = `nakami:pending-prompt:${threadId}`;
    const stored = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);

    // History already exists, or a run is still streaming: not a fresh thread.
    if (messages.length > 0 || isLoading) return;

    const prompt = firstPrompt?.trim() || stored;
    if (prompt) send(prompt);
  }, [isHydrating, firstPrompt, isLoading, messages.length, send, threadId]);

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

  useEffect(() => {
    if (!latestPlan) return;

    const prev = boardRef.current;
    const isNewRun =
      boardMessageRef.current !== null &&
      boardMessageRef.current !== latestPlan.messageId;

    const holding =
      isNewRun &&
      !latestPlan.complete &&
      latestPlan.board.products.length < prev.products.length;
    if (holding) return;

    boardMessageRef.current = latestPlan.messageId;
    setBoard(mergeBoard(prev, latestPlan.board));
  }, [latestPlan]);

  const agentLayout = useMemo(() => readLatestSceneLayout(loose), [loose]);

  const sceneProducts = useMemo(
    () => board.products.filter((p) => selected.has(p.slot)),
    [board.products, selected],
  );

  const sceneLayout = useMemo<SceneLayout | null>(() => {
    if (sceneProducts.length === 0) return null;
    return buildSceneLayout({
      productIds: sceneProducts.map((p) => p.id),
      roomType: agentLayout?.room.type ?? "living-room",
      notes: agentLayout?.notes,
      estimates: estimateDimensionsFromTitles(
        sceneProducts.map((p) => ({ productId: p.id, title: p.name })),
      ),
    });
  }, [sceneProducts, agentLayout]);

  const productById = useMemo(
    () => new Map(board.products.map((p) => [p.id, p])),
    [board.products],
  );

  const previewItems = useMemo<PreviewItem[]>(() => {
    if (!sceneLayout) return [];
    return sceneLayout.items.flatMap((placement) => {
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
  }, [sceneLayout, productById, byProduct]);

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

  /** Preview tab: generate the placed products that have no job yet. */
  function handlePreviewGenerate() {
    void generate(
      previewItems
        .filter((item) => !item.job)
        .map((item) => ({
          productId: item.productId,
          imageUrl: item.imageUrl ?? undefined,
          prompt: item.name,
        })),
    );
  }

  /** Preview tab: regenerate one failed product. */
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
                    <BackLink busy={isLoading} iconOnly />
                    <div className="flex items-center gap-2">
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
                      onCategoryChange={handleCategoryChange}
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
                    <>
                      <BackLink busy={isLoading} iconOnly />
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
                    </>
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
                    layout={sceneLayout}
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
                    hasProducts={board.products.length > 0}
                    onGoToBoard={() => setTab("board")}
                    onGoToChat={() => setTab("chat")}
                  />
                ) : (
                  <BoardPanel
                    board={board}
                    threadId={threadId}
                    running={isLoading}
                    selected={selectedSlots}
                    purchasedIds={purchasedIds}
                    onPaid={handlePaid}
                    jobs={byProduct}
                    generating={generating}
                    generateError={generateError}
                    pinnedPreviewUrl={pinnedPreview}
                    onOpenPreview={() => setTab("preview")}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    onClearSelection={clearSelection}
                    onGenerate={handleGenerate}
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
            onCategoryChange={handleCategoryChange}
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
            threadId={threadId}
            running={isLoading}
            selected={selectedSlots}
            purchasedIds={purchasedIds}
            onPaid={handlePaid}
            jobs={byProduct}
            generating={generating}
            generateError={generateError}
            pinnedPreviewUrl={pinnedPreview}
            onOpenPreview={() => setTab("preview")}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onGenerate={handleGenerate}
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
              layout={sceneLayout}
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
              hasProducts={board.products.length > 0}
              onGoToBoard={() => setTab("board")}
              onGoToChat={() => setTab("chat")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
