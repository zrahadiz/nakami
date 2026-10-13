import { api } from '@/lib/api/axios'

export interface Thread {
  id: string
  name: string
  firstPrompt?: string | null
  /** Pinned 3D scene preview capture (threads.preview_image_url), if any. */
  previewImageUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateThreadInput {
  name: string
  firstPrompt?: string
}

export async function getThreads(): Promise<Thread[]> {
  const { data } = await api.get<Thread[]>('/threads')

  return data
}

export async function createThread(
  name: string,
  firstPrompt?: string
): Promise<Thread> {
  const { data } = await api.post<Thread>('/threads', {
    name,
    firstPrompt,
  })

  return data
}