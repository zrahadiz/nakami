// lib/workspace/scene-plan.ts
//
// Turns the build_scene_layout tool output the agent streams into the
// SceneLayout the preview scene renders (the counterpart of agent-plan.ts,
// which reads the structured plan).
//
// Tool-call parts arrive in two shapes, both read tolerantly:
//   live (TanStack AI):  { type: 'tool-call', name, state, output }
//   persisted history:   { type: 'tool-call', toolName, args, result }
// The result itself is either { layout: SceneLayout } (what the tool returns)
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

/** States that have not produced their output yet — never read their payload. */
const IN_FLIGHT = new Set([
  'awaiting-input',
  'input-streaming',
  'input-complete',
  'output-streaming',
])

const TERMINAL = new Set(['output-complete', 'output-available', 'success', 'done'])

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

/** The layout a single assistant message produced, or null. */
export function readMessageSceneLayout(message: LooseMessage): SceneLayout | null {
  if (message.role !== 'assistant') return null

  for (const part of message.parts ?? []) {
    if (!isObj(part) || part.type !== 'tool-call') continue

    const name = part.toolName ?? part.name
    if (name !== 'build_scene_layout') continue

    const state = typeof part.state === 'string' ? part.state : null
    // Persisted history has no state; live parts must be terminal.
    if (state) {
      if (IN_FLIGHT.has(state)) continue
      if (!TERMINAL.has(state)) continue
    }

    const layout = toLayout(part.output ?? part.result ?? part.data)
    if (layout) return layout
  }

  return null
}

/** The most recent layout across the chat (newest wins). */
export function readLatestSceneLayout(messages: LooseMessage[]): SceneLayout | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const layout = readMessageSceneLayout(messages[i])
    if (layout) return layout
  }
  return null
}
