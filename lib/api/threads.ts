import { api } from '@/lib/api/axios'
import type { ThreadCategory } from '@/lib/types'

export interface Thread {
  id: string
  name: string
  firstPrompt?: string | null
  /** Shopping category chosen when the board was created. */
  category: ThreadCategory
  /** Pinned 3D scene preview capture (threads.preview_image_url), if any. */
  previewImageUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateThreadInput {
  name: string
  firstPrompt?: string
  category?: ThreadCategory
}

export async function getThreads(): Promise<Thread[]> {
  const { data } = await api.get<Thread[]>('/threads')

  return data
}

export async function createThread(
  name: string,
  firstPrompt?: string,
  category: ThreadCategory = 'furniture'
): Promise<Thread> {
  const { data } = await api.post<Thread>('/threads', {
    name,
    firstPrompt,
    category,
  })

  return data
}

export async function updateThreadCategory(
  threadId: string,
  category: ThreadCategory
): Promise<Thread> {
  const { data } = await api.patch<Thread>(
    `/threads/${encodeURIComponent(threadId)}`,
    { category }
  )

  return data
}
