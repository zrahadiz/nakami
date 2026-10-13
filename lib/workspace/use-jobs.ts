'use client'

// components/workspace/use-jobs.ts
//
// TanStack Query wrapper around your /api/jobs route:
//   GET  /api/jobs?threadId=...  -> list jobs (polled while any is queued/running)
//   POST /api/jobs               -> queue an image-to-3D (or text-to-3D) job per product
//
// The job shape is read tolerantly (camelCase or snake_case), so it works with
// whatever `jobFromRow` returns.

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Job = {
  id: string
  productId: string | null
  /** 'queued' | 'running' | 'ready' | 'failed' */
  status: string
  assetUrl: string | null
  error: string | null
  createdAt: string
}

export type GenerateItem = {
  productId: string
  imageUrl?: string
  /** Used for text-to-3D when the product has no image. */
  prompt: string
}

type Loose = Record<string, unknown>

const isObj = (v: unknown): v is Loose =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

export function normalizeJob(raw: unknown): Job | null {
  if (!isObj(raw)) return null

  const id = str(raw.id)
  if (!id) return null

  return {
    id,
    productId: str(raw.productId) ?? str(raw.product_id),
    status: str(raw.status) ?? 'queued',
    assetUrl: str(raw.assetUrl) ?? str(raw.asset_url),
    error: str(raw.error) ?? str(raw.errorMessage) ?? str(raw.error_message),
    createdAt: str(raw.createdAt) ?? str(raw.created_at) ?? '',
  }
}

const inProgress = (job: Job) => job.status === 'queued' || job.status === 'running'

export function useJobs(threadId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['jobs', threadId] as const

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/jobs?threadId=${encodeURIComponent(threadId)}`)
      if (!res.ok) throw new Error('Failed to load 3D jobs')

      const data: unknown = await res.json()
      return (Array.isArray(data) ? data : [])
        .map(normalizeJob)
        .filter((job): job is Job => job !== null)
    },
    // Keep polling only while something is still generating.
    refetchInterval: (q) => (q.state.data?.some(inProgress) ? 3000 : false),
  })

  /** Latest job per product id. */
  const byProduct = useMemo(() => {
    const map = new Map<string, Job>()
    for (const job of query.data ?? []) {
      if (!job.productId) continue
      const prev = map.get(job.productId)
      if (!prev || job.createdAt >= prev.createdAt) map.set(job.productId, job)
    }
    return map
  }, [query.data])

  const mutation = useMutation({
    mutationFn: async (items: GenerateItem[]) => {
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              threadId,
              productId: item.productId,
              // Your route needs exactly one of imageUrl / prompt.
              ...(item.imageUrl ? { imageUrl: item.imageUrl } : { prompt: item.prompt }),
            }),
          })

          if (!res.ok) {
            const body: unknown = await res.json().catch(() => null)
            const message = isObj(body) ? str(body.error) : null
            throw new Error(message ?? 'Failed to start 3D generation')
          }
        })
      )

      const failed = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      )
      if (failed) {
        throw failed.reason instanceof Error
          ? failed.reason
          : new Error('Failed to start 3D generation')
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  /** Queue jobs for products that don't already have a running or finished one. */
  async function generate(items: GenerateItem[]) {
    const todo = items.filter((item) => {
      const job = byProduct.get(item.productId)
      return !job || job.status === 'failed'
    })
    if (todo.length === 0) return

    try {
      await mutation.mutateAsync(todo)
    } catch {
      /* surfaced through `generateError` */
    }
  }

  return {
    byProduct,
    generate,
    generating: mutation.isPending,
    generateError: mutation.error?.message ?? null,
  }
}