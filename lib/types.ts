// Shared types from the Week 1 interface contract.
// Define them once, use them everywhere (BE-1…BE-5, FE tickets).

import type { AgentPlan } from './agent/schema'
import type { FalModelKind, FalQueueStatus } from './fal/models'

export type { AgentPlan }

// Scene contract re-exported here so the layout tool output and the API
// surface share one type vocabulary (T3/T6).
export type {
  ItemPlacement,
  ItemRole,
  RoomPreset,
  RoomType,
  SceneLayout,
  Wall,
} from './scene/contract'

// 3D generation jobs (T5). Kind and status reuse the fal-layer unions so the
// API contract cannot drift from what the worker actually persists.
export type JobKind = FalModelKind
export type JobStatus = FalQueueStatus

export interface GenerationJob {
  id: string
  userId: string
  threadId: string
  kind: JobKind
  status: JobStatus
  cacheKey: string
  productId: string | null
  inputUrl: string | null
  inputPrompt: string | null
  falRequestId: string | null
  assetId: string | null
  assetUrl: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

// Product returned by Channel3 search or local fallback catalog
export interface Product {
  id: string;
  title: string;
  imageUrl: string;
  price: { amount: number; currency: string } | null;
  retailer: string;
  availability: "InStock" | "LimitedAvailability" | "SoldOut" | "Unknown";
  url: string;
}

// Search constraints passed to searchProducts (Channel3 or local fallback).
export interface SearchFilters {
  // Category to scope the search to (e.g. "armchair", "floor lamp").
  category?: string;
  // Inclusive price bounds in the product's currency (USD for the demo).
  minPrice?: number;
  maxPrice?: number;
}

// Estimated physical bounding box for a product
// (Week 1: static category heuristic, not a real measurement).
export interface DimensionEstimate {
  productId: string;
  // Heuristic category the box came from; null when the default box was used.
  category: string | null;
  length: number;
  width: number;
  height: number;
  unit: "cm" | "in";
}

// Thread
export type ThreadCategory = "furniture" | "gaming";

export interface Thread {
  id: string;
  userId: string;
  name: string;
  firstPrompt: string | null;
  /** Shopping category chosen when the board was created. */
  category: ThreadCategory;
  /** Pinned 3D preview capture (thread-thumbnails bucket), null until pinned. */
  previewImageUrl: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// Chat message (aligned with TanStack AI UIMessage)
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: (
    | { type: "text"; text: string }
    | { type: "tool-call"; toolName: string; args: unknown; result?: unknown }
    | {
        type: "structured-output";
        data: AgentPlan;
        status: "streaming" | "complete";
      }
  )[];
}
