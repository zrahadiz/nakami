// lib/workspace/scene-plan.ts
//
// Turns the build_scene_layout tool output the agent streams into the
// SceneLayout the preview scene renders (the counterpart of agent-plan.ts,
// which reads the structured plan).
//
// The layout shows up in two shapes; both are read tolerantly:
//   live (TanStack AI):  a finished ToolCallPart — { type: 'tool-call', name,
//     state: 'complete', output } — plus its sibling ToolResultPart.
//   persisted history (GET /api/chat reconstruct): tool-call parts always have
//     state 'input-complete' and NO output — the result lives in a separate
//     { type: 'tool-result', toolCallId, content } part, in its own message.
// The result payload is either { layout: SceneLayout } (what the tool returns)
// or the bare layout — accept both, and validate before trusting anything.

import {
  ITEM_ROLES,
  ROOM_TYPES,
  WALLS,
  type ItemPlacement,
  type ItemRole,
  type RoomType,
  type SceneLayout,
  type Wall,
} from '@/lib/scene/contract'
import type { LooseMessage } from './agent-plan'

type Loose = Record<string, unknown>

const isObj = (v: unknown): v is Loose =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const isRoomType = (v: unknown): v is RoomType =>
  typeof v === 'string' && (ROOM_TYPES as readonly string[]).includes(v)

const isWall = (v: unknown): v is Wall =>
  typeof v === 'string' && (WALLS as readonly string[]).includes(v)

const isItemRole = (v: unknown): v is ItemRole =>
  typeof v === 'string' && (ITEM_ROLES as readonly string[]).includes(v)

/** ToolCallState values that have not produced output yet — never read a
 *  payload from them. `input-complete` is deliberately NOT here: it is the
 *  state persisted tool calls keep forever (reconstructed history), with the
 *  output living in the matching tool-result part instead. */
const IN_FLIGHT = new Set([
  'awaiting-input',
  'input-streaming',
  'output-streaming',
  'approval-requested',
  'approval-responded',
])

/** Validate a payload into a SceneLayout, or reject it. */
function toLayout(payload: unknown): SceneLayout | null {
  if (!isObj(payload)) return null

  // The tool returns { layout }, but tolerate the bare layout too.
  const source = isObj(payload.layout) ? payload.layout : payload

  const room = source.room
  if (!isObj(room)) return null
  if (!isRoomType(room.type)) return null
  if (!isWall(room.windowWall)) return null
  if (!isNum(room.width) || !isNum(room.depth) || !isNum(room.height)) return null
  if (room.width <= 0 || room.depth <= 0 || room.height <= 0) return null

  const rawItems = source.items
  if (!Array.isArray(rawItems)) return null

  const items: ItemPlacement[] = []
  for (const raw of rawItems) {
    if (!isObj(raw)) return null

    const { productId, position, footprint } = raw
    if (typeof productId !== 'string' || productId === '') return null
    if (!isObj(position) || !isNum(position.x) || !isNum(position.y) || !isNum(position.z)) {
      return null
    }
    if (
      !isObj(footprint) ||
      !isNum(footprint.width) ||
      !isNum(footprint.depth) ||
      !isNum(footprint.height) ||
      footprint.width <= 0 ||
      footprint.depth <= 0 ||
      footprint.height < 0
    ) {
      return null
    }
    if (typeof raw.rotationY !== 'number' || !Number.isFinite(raw.rotationY)) return null
    if (!isItemRole(raw.role)) return null

    items.push({
      productId,
      role: raw.role,
      position: { x: position.x, y: position.y, z: position.z },
      rotationY: raw.rotationY,
      footprint: {
        width: footprint.width,
        depth: footprint.depth,
        height: footprint.height,
      },
    })
  }

  return {
    room: {
      type: room.type,
      label: typeof room.label === 'string' && room.label ? room.label : room.type,
      width: room.width,
      depth: room.depth,
      height: room.height,
      windowWall: room.windowWall,
    },
    items,
    ...(typeof source.notes === 'string' && source.notes ? { notes: source.notes } : {}),
  }
}

/** The layout a single assistant message produced, or null.
 *  `layoutCallIds` lets a caller pair tool-result parts across messages
 *  (persisted history); live results land in the same message as the call. */
export function readMessageSceneLayout(
  message: LooseMessage,
  layoutCallIds?: ReadonlySet<string>
): SceneLayout | null {
  if (message.role !== 'assistant') return null

  const parts = message.parts ?? []

  // Ids of this message's build_scene_layout calls — a tool result in the
  // same message pairs with them (live shape).
  const localCallIds = new Set<string>()
  for (const part of parts) {
    if (!isObj(part) || part.type !== 'tool-call') continue
    const name = part.toolName ?? part.name
    if (name === 'build_scene_layout' && typeof part.id === 'string') {
      localCallIds.add(part.id)
    }
  }

  for (const part of parts) {
    if (!isObj(part)) continue

    // Tool-result part: the output for a call whose part has none (this is
    // where reconstructed history keeps the layout).
    if (part.type === 'tool-result') {
      const callId = part.toolCallId
      if (
        typeof callId === 'string' &&
        (localCallIds.has(callId) || layoutCallIds?.has(callId))
      ) {
        if (part.state === 'error') continue
        const layout = toLayout(parseToolResultPayload(part.content))
        if (layout) return layout
      }
      continue
    }

    if (part.type !== 'tool-call') continue
    const name = part.toolName ?? part.name
    if (name !== 'build_scene_layout') continue

    const state = typeof part.state === 'string' ? part.state : null
    if (state && (IN_FLIGHT.has(state) || state === 'error')) continue

    // A terminal part carries the output directly; a call that terminated
    // without one (persisted 'input-complete') falls through to its result
    // part, paired by id in an earlier/later message.
    const layout = toLayout(part.output ?? part.result ?? part.data)
    if (layout) return layout
  }

  return null
}

/** Parse a ToolResultPart.content into the tool's return payload. Persisted
 *  results are raw JSON strings; live ones may arrive as content parts. */
function parseToolResultPayload(content: unknown): unknown {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!isObj(part) || part.type !== 'text') continue
      const text = typeof part.content === 'string' ? part.content : part.text
      if (typeof text !== 'string') continue
      try {
        return JSON.parse(text)
      } catch {
        // Not JSON — keep scanning the remaining text parts.
      }
    }
    return null
  }
  return isObj(content) ? content : null
}

/** The most recent layout across the chat (newest wins). Pairs tool-call
 *  parts with their result parts across messages, so reconstructed history
 *  (where a call and its result live in separate messages) resolves too. */
export function readLatestSceneLayout(messages: LooseMessage[]): SceneLayout | null {
  const layoutCallIds = new Set<string>()
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!isObj(part) || part.type !== 'tool-call') continue
      const name = part.toolName ?? part.name
      if (name === 'build_scene_layout' && typeof part.id === 'string') {
        layoutCallIds.add(part.id)
      }
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const layout = readMessageSceneLayout(messages[i], layoutCallIds)
    if (layout) return layout
  }
  return null
}
