'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Armchair,
  ArrowRight,
  Gamepad2,
  Loader2,
  Plus,
  RotateCw,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// ⚠️ Keep your existing imports for these; adjust paths if they differ.
import { createThread, getThreads } from '@/lib/api/threads'
import type { Thread } from '@/lib/api/threads'

/* ---------- Board cover (generated, deterministic) ---------- */

const interiorPalettes = [
  ['#E8E1D5', '#C9A27A', '#7A8B6F'],
  ['#EFE9DD', '#B9A58B', '#2F3E5C'],
  ['#E4DCCD', '#D9623B', '#7A8B6F'],
]

const gamingPalettes = [
  ['#2A2250', '#8B6CFF', '#E8E1D5'],
  ['#14120F', '#8B6CFF', '#2F3E5C'],
]

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Heuristic until threads store a real category.
const isGaming = (name: string) =>
  /gam|rgb|battlestation|streamer|esports|pc setup/i.test(name)

function Cover({ id, name, previewUrl }: { id: string; name: string; previewUrl?: string | null }) {
  const gaming = isGaming(name)
  const palettes = gaming ? gamingPalettes : interiorPalettes
  const [a, b, c] = palettes[hash(id) % palettes.length]
  const Icon = gaming ? Gamepad2 : Armchair
  const ink = gaming ? '#E8E1D5' : '#1E1B18'

  return (
    <div
      aria-hidden
      className="relative h-40 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${a}, ${gaming ? '#14120F' : '#DDD3C0'})`,
      }}
    >
      {previewUrl ? (
        // Pinned 3D scene preview (T11) — falls back to the generated art.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <>
          <span
            className="absolute bottom-0 left-[8%] h-[46%] w-[44%] rounded-t-3xl transition-transform duration-300 group-hover:-translate-y-1"
            style={{ background: b }}
          />
          <span
            className="absolute right-[12%] top-[16%] size-14 rounded-full"
            style={{ background: c }}
          />
          <span
            className="absolute bottom-0 right-[10%] h-[62%] w-3 rounded-t-full"
            style={{ background: ink }}
          />
          <Icon
            className="absolute left-3.5 top-3.5 size-5"
            style={{ color: ink, opacity: 0.55 }}
          />
        </>
      )}
    </div>
  )
}

/* ---------- Component ---------- */

export function RecentProjects() {
  const router = useRouter()

  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      try {
        const data = await getThreads()

        if (!cancelled) {
          setThreads(data)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load boards')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProjects()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function retry() {
    setError(null)
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  async function handleNewProject() {
    if (creating) return

    setCreating(true)

    try {
      const thread = await createThread('Untitled board')

      router.push(`/workspace/${thread.id}`)
    } catch {
      setError('Failed to create board')
    } finally {
      setCreating(false)
    }
  }

  const filteredThreads = threads.filter((thread) =>
    thread.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section className="mx-auto mt-16 w-full max-w-6xl sm:mt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight sm:text-4xl">
            Recent boards
          </h2>

          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick up where you left off.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search boards..."
              aria-label="Search boards"
              className="h-10 w-full rounded-xl border-input bg-card pl-10 sm:w-60"
            />
          </div>

          <Button
            onClick={handleNewProject}
            disabled={creating}
            className="h-10 shrink-0 rounded-xl bg-[#D9623B] px-4 text-white shadow-[0_8px_20px_-10px_rgba(217,98,59,0.9)] hover:bg-[#C4532D]"
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            <span className="hidden sm:inline">New board</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All boards</TabsTrigger>
          <TabsTrigger value="favorites" disabled title="Favorites coming soon">
            Favorites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {error && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium outline-none transition hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                <RotateCw className="size-3.5" />
                Try again
              </button>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {/* NEW BOARD CARD */}
            <button
              type="button"
              onClick={handleNewProject}
              disabled={creating}
              className="group flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-input bg-card/50 px-6 text-center outline-none transition hover:border-[#D9623B]/60 hover:bg-[#D9623B]/5 focus-visible:ring-4 focus-visible:ring-[#D9623B]/25 disabled:opacity-50"
            >
              <span className="grid size-12 place-items-center rounded-full bg-[#D9623B]/12 text-[#D9623B] transition group-hover:scale-105">
                {creating ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <Plus className="size-6" />
                )}
              </span>

              <span className="mt-4 font-[family-name:var(--font-display)] text-xl font-medium">
                Start a new board
              </span>

              <span className="mt-1 text-xs text-muted-foreground">
                Describe a vibe, get the whole look
              </span>
            </button>

            {/* LOADING */}
            {loading &&
              [0, 1].map((index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <Skeleton className="h-40 w-full rounded-none" />

                  <div className="space-y-3 p-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}

            {/* BOARD CARDS */}
            {!loading &&
              filteredThreads.map((thread) => {
                const gaming = isGaming(thread.name)

                return (
                  <Link
                    key={thread.id}
                    href={`/workspace/${thread.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card outline-none transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-4 focus-visible:ring-[#D9623B]/25"
                  >
                    <Cover
                      id={String(thread.id)}
                      name={thread.name}
                      previewUrl={thread.previewImageUrl}
                    />

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 font-medium leading-snug">
                        {thread.name}
                      </h3>

                      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-1.5 rounded-full"
                            style={{ background: gaming ? '#8B6CFF' : '#7A8B6F' }}
                            aria-hidden
                          />
                          {gaming ? 'Gaming setup' : 'Interior'}
                        </span>

                        <span className="flex items-center gap-1 font-medium text-foreground/70 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          Open
                          <ArrowRight className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
          </div>

          {!loading && threads.length === 0 && !error && (
            <p className="mx-auto mt-8 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              You don&apos;t have any boards yet. Start by describing your dream
              space!
            </p>
          )}

          {!loading && threads.length > 0 && filteredThreads.length === 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              No boards match &ldquo;{search}&rdquo;.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}