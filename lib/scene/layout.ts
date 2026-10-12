import { estimateDimensionsForProducts } from '@/lib/agent/dimensions'
import {
  FLOOR_Y,
  ROOM_PRESETS,
  SNAP_STEP_M,
  WALL_MARGIN_M,
  WALLS,
  cmToM,
  rotationToward,
  snapToGrid,
  wallAnchor,
  type ItemPlacement,
  type ItemRole,
  type RoomPreset,
  type RoomType,
  type SceneLayout,
  type Vec2,
  type Wall,
} from './contract'

// T6: rule-based scene layout engine. Pure and deterministic — the same input
// always produces the same placements, so tests and the Preview tab (T9) can
// rely on it. No network: product context comes from the in-process registry
// that searchProducts() fills, via estimateDimensionsForProducts().
//
// Rules, in placement order:
//  1. Seating anchors the room: the group is centered on the wall opposite the
//     window and faces it.
//  2. Coffee/side tables sit in front of the group, dining tables at center.
//  3. The rug is centered under the seating + table group.
//  4. Storage is flush against the back wall; lamps flank the group; pendants
//     hang over the table; wall art/mirrors go on the back wall; plants/vases
//     take the corners.
//  5. Floor items are nudged apart, clamped to the room, snapped to the grid.

/** Free space kept between grouped items. */
const GAP_M = 0.15
/** Bottom of wall-mounted art/mirrors sits so their center is ~1.5 m high. */
const WALL_ART_CENTER_M = 1.5
/** Wall art spread between multiple pieces, meters. */
const WALL_ART_SPACING_M = 1.2
const NUDGE_ATTEMPTS = 24

/** Overlap resolution order: furniture first, decoration yields last. */
const NUDGE_PRIORITY: Record<ItemRole, number> = {
  rug: 0,
  seating: 1,
  table: 2,
  storage: 3,
  lighting: 4,
  decor: 5,
}

const ROLE_BY_CATEGORY: Record<string, ItemRole> = {
  armchair: 'seating',
  sofa: 'seating',
  loveseat: 'seating',
  ottoman: 'seating',
  bench: 'seating',
  'floor lamp': 'lighting',
  'table lamp': 'lighting',
  'pendant light': 'lighting',
  'coffee table': 'table',
  'side table': 'table',
  'dining table': 'table',
  rug: 'rug',
  bookshelf: 'storage',
  sideboard: 'storage',
  'wall art': 'decor',
  mirror: 'decor',
  vase: 'decor',
  plant: 'decor',
}

const WALL_DECOR = new Set(['wall art', 'mirror'])
const PENDANTS = new Set(['pendant light'])

export interface BuildSceneLayoutInput {
  productIds: string[]
  roomType: RoomType
  notes?: string
}

interface WorkItem {
  productId: string
  role: ItemRole
  category: string | null
  width: number
  depth: number
  height: number
  position: Vec2
  /** Base elevation: FLOOR_Y for floor items, a mount height for wall pieces. */
  y: number
  rotationY: number
}

export function buildSceneLayout({
  productIds,
  roomType,
  notes,
}: BuildSceneLayoutInput): SceneLayout {
  const room = ROOM_PRESETS[roomType]
  const estimates = estimateDimensionsForProducts(productIds)

  const items: WorkItem[] = estimates.map((estimate) => {
    const role = (estimate.category && ROLE_BY_CATEGORY[estimate.category]) || 'decor'
    return {
      productId: estimate.productId,
      role,
      category: estimate.category,
      // DimensionEstimate is centimeters; the scene is meters (T3 contract).
      width: cmToM(estimate.length),
      depth: cmToM(estimate.width),
      height: cmToM(estimate.height),
      position: { x: 0, z: 0 },
      y: FLOOR_Y,
      rotationY: 0,
    }
  })

  const seating = items
    .filter((item) => item.role === 'seating')
    .sort((a, b) => b.width - a.width)
  const diningTables = items.filter(
    (item) => item.role === 'table' && item.category === 'dining table'
  )
  const salonTables = items.filter(
    (item) => item.role === 'table' && item.category !== 'dining table'
  )
  const rugs = items.filter((item) => item.role === 'rug')
  const storage = items.filter((item) => item.role === 'storage')
  const lighting = items.filter((item) => item.role === 'lighting')
  const decor = items.filter((item) => item.role === 'decor')

  // ---- 1. Seating run, centered on the wall opposite the window ----------
  const windowAnchor = wallAnchor(room.windowWall, room)
  const backWall = oppositeWall(room.windowWall)
  const backAnchor = wallAnchor(backWall, room)
  const inward = backAnchor.inward
  const tangent: Vec2 = inward.x === 0 ? { x: 1, z: 0 } : { x: 0, z: 1 }
  const faceWindow = (position: Vec2) => rotationToward(position, windowAnchor.position)

  const runWidth =
    seating.reduce((sum, seat) => sum + seat.width, 0) +
    GAP_M * Math.max(0, seating.length - 1)

  let cursor = -runWidth / 2
  for (const seat of seating) {
    const offset = cursor + seat.width / 2
    seat.position = {
      x: backAnchor.position.x + inward.x * (seat.depth / 2 + WALL_MARGIN_M) + tangent.x * offset,
      z: backAnchor.position.z + inward.z * (seat.depth / 2 + WALL_MARGIN_M) + tangent.z * offset,
    }
    seat.rotationY = faceWindow(seat.position)
    cursor += seat.width + GAP_M
  }

  const seatingCentroid = centroid(seating.map((item) => item.position)) ?? { x: 0, z: 0 }
  // Half depth of the tilted seating boxes, so the table clears them.
  const groupHalfDepth = seating.length
    ? Math.max(...seating.map((seat) => rotatedExtents(seat).hd))
    : 0

  // ---- 2. Tables ----------------------------------------------------------
  salonTables.forEach((table, index) => {
    if (seating.length === 0) {
      const sideOffset = index === 0 ? 0 : (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2) * (table.width + GAP_M)
      table.position = { x: tangent.x * sideOffset, z: tangent.z * sideOffset }
    } else {
      const frontDistance = groupHalfDepth + GAP_M + rotatedExtents(table).hd
      const sideOffset =
        index === 0 ? 0 : (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2) * (table.width + GAP_M)
      table.position = {
        x: seatingCentroid.x + inward.x * frontDistance + tangent.x * sideOffset,
        z: seatingCentroid.z + inward.z * frontDistance + tangent.z * sideOffset,
      }
    }
    table.rotationY = faceWindow(table.position)
  })

  diningTables.forEach((table) => {
    table.position = { x: 0, z: 0 }
    // Run the long edge along the longer room axis.
    table.rotationY = room.depth > room.width ? Math.PI / 2 : 0
  })

  // ---- 3. Storage, lighting, decor ---------------------------------------
  // Storage: flush against a side wall, pulled toward the back corner.
  const sideWalls = WALLS.filter((wall) => wall !== backWall && wall !== room.windowWall)
  storage.forEach((item, index) => {
    const wall = sideWalls[Math.floor(index / 2) % sideWalls.length]
    mountOnWall(item, wall, room, backAnchor.position)
  })

  const floorLamps = lighting.filter((item) => !PENDANTS.has(item.category ?? ''))
  floorLamps.forEach((lamp, index) => {
    const side = index % 2 === 0 ? 1 : -1
    const step = Math.floor(index / 2)
    if (seating.length > 0) {
      const offset = side * (runWidth / 2 + GAP_M + lamp.width / 2 + step * (lamp.width + GAP_M))
      lamp.position = {
        x: seatingCentroid.x + tangent.x * offset + inward.x * groupHalfDepth,
        z: seatingCentroid.z + tangent.z * offset + inward.z * groupHalfDepth,
      }
    } else {
      lamp.position = cornerSlot(room, lamp, index)
    }
    lamp.rotationY = faceWindow(lamp.position)
  })

  lighting
    .filter((item) => PENDANTS.has(item.category ?? ''))
    .forEach((pendant, index) => {
      const host = diningTables[index] ?? salonTables[0]
      pendant.position = host ? { ...host.position } : { x: 0, z: 0 }
      pendant.y = Math.max(FLOOR_Y, room.height - pendant.height)
    })

  const wallDecor = decor.filter((item) => WALL_DECOR.has(item.category ?? ''))
  const floorDecor = decor.filter((item) => !WALL_DECOR.has(item.category ?? ''))

  wallDecor.forEach((item, index) => {
    const spread = (index - (wallDecor.length - 1) / 2) * WALL_ART_SPACING_M
    item.position = {
      x: backAnchor.position.x + inward.x * (item.depth / 2 + 0.02) + tangent.x * spread,
      z: backAnchor.position.z + inward.z * (item.depth / 2 + 0.02) + tangent.z * spread,
    }
    item.y = WALL_ART_CENTER_M - item.height / 2
    item.rotationY = rotationToward(item.position, {
      x: item.position.x + inward.x,
      z: item.position.z + inward.z,
    })
  })

  floorDecor.forEach((item, index) => {
    item.position = cornerSlot(room, item, index)
    item.rotationY = faceWindow(item.position)
  })

  // ---- 4. Nudge apart, clamp to the room, snap to the grid ---------------
  // Resolve in structural order so decorative items yield to furniture.
  const floorItems = items
    .filter((item) => item.y === FLOOR_Y && item.role !== 'rug')
    .sort((a, b) => NUDGE_PRIORITY[a.role] - NUDGE_PRIORITY[b.role])
  const placed: WorkItem[] = []
  for (const item of floorItems) {
    item.position = resolveOverlaps(item, placed, room, tangent, inward)
    placed.push(item)
  }

  for (const item of items) {
    item.position = {
      x: snapToGrid(clampToRoom(item, room).x),
      z: snapToGrid(clampToRoom(item, room).z),
    }
  }

  // ---- 5. Rug under the final group position -----------------------------
  const rugCentroid =
    centroid([...seating, ...salonTables].map((item) => item.position)) ?? { x: 0, z: 0 }
  for (const rug of rugs) {
    rug.position = { x: snapToGrid(rugCentroid.x), z: snapToGrid(rugCentroid.z) }
    // Align the rug's width with the seating run.
    rug.rotationY = tangent.x === 1 ? 0 : Math.PI / 2
  }

  const placements: ItemPlacement[] = items.map((item) => ({
    productId: item.productId,
    role: item.role,
    position: { x: item.position.x, y: item.y, z: item.position.z },
    rotationY: item.rotationY,
    footprint: { width: item.width, depth: item.depth, height: item.height },
  }))

  const trimmedNotes = notes?.trim()
  return {
    room,
    items: placements,
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
  }
}

// ---------------------------------------------------------------------------

function oppositeWall(wall: Wall): Wall {
  switch (wall) {
    case 'north':
      return 'south'
    case 'east':
      return 'west'
    case 'south':
      return 'north'
    case 'west':
      return 'east'
  }
}

function centroid(points: Vec2[]): Vec2 | null {
  if (points.length === 0) return null
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), {
    x: 0,
    z: 0,
  })
  return { x: sum.x / points.length, z: sum.z / points.length }
}

/** Corner slots ordered north-west, north-east, south-west, south-east. */
function cornerSlot(room: RoomPreset, item: WorkItem, index: number): Vec2 {
  const insetX = Math.max(0, room.width / 2 - WALL_MARGIN_M - item.width / 2)
  const insetZ = Math.max(0, room.depth / 2 - WALL_MARGIN_M - item.depth / 2)
  const corners: Vec2[] = [
    { x: -insetX, z: -insetZ },
    { x: insetX, z: -insetZ },
    { x: -insetX, z: insetZ },
    { x: insetX, z: insetZ },
  ]
  return corners[index % corners.length]
}

/**
 * Flush-mount an item on a wall, offset along the wall toward `toward` and
 * clamped so the yaw-rotated box stays inside the room. Sets the item's yaw so
 * its front (+Z) points into the room.
 */
function mountOnWall(item: WorkItem, wall: Wall, room: RoomPreset, toward: Vec2): void {
  const anchor = wallAnchor(wall, room)
  item.rotationY = Math.atan2(anchor.inward.x, anchor.inward.z)

  const { hw, hd } = rotatedExtents(item)
  const alongX = anchor.inward.x === 0
  const normalExtent = alongX ? hd : hw
  const tangentExtent = alongX ? hw : hd
  const halfAlong = (alongX ? room.width : room.depth) / 2
  const maxOffset = Math.max(0, halfAlong - tangentExtent - WALL_MARGIN_M)
  const desired = alongX ? toward.x - anchor.position.x : toward.z - anchor.position.z
  const offset = Math.min(maxOffset, Math.max(-maxOffset, desired))

  item.position = {
    x: anchor.position.x + anchor.inward.x * (normalExtent + WALL_MARGIN_M) + (alongX ? offset : 0),
    z: anchor.position.z + anchor.inward.z * (normalExtent + WALL_MARGIN_M) + (alongX ? 0 : offset),
  }
}

/** Axis-aligned half extents of the yaw-rotated footprint. */
function rotatedExtents(item: WorkItem): { hw: number; hd: number } {
  const cos = Math.abs(Math.cos(item.rotationY))
  const sin = Math.abs(Math.sin(item.rotationY))
  return {
    hw: (item.width * cos + item.depth * sin) / 2,
    hd: (item.width * sin + item.depth * cos) / 2,
  }
}

function overlaps(a: WorkItem, b: WorkItem): boolean {
  const aBox = rotatedExtents(a)
  const bBox = rotatedExtents(b)
  return (
    Math.abs(a.position.x - b.position.x) < aBox.hw + bBox.hw + 0.02 &&
    Math.abs(a.position.z - b.position.z) < aBox.hd + bBox.hd + 0.02
  )
}

/**
 * Move an item until it clears everything already placed: first along the
 * seating run, then into the room when that direction is blocked (e.g. a
 * clamped sideboard stuck in a corner). Deterministic: fixed step, fixed order.
 */
function resolveOverlaps(
  item: WorkItem,
  placed: WorkItem[],
  room: RoomPreset,
  tangent: Vec2,
  inward: Vec2
): Vec2 {
  const hits = (position: Vec2) =>
    placed.some((other) => overlaps({ ...item, position }, other))
  let position = { ...item.position }

  for (let attempt = 0; attempt < NUDGE_ATTEMPTS && hits(position); attempt++) {
    position = clampToRoom(
      {
        ...item,
        position: {
          x: position.x + tangent.x * SNAP_STEP_M * 2,
          z: position.z + tangent.z * SNAP_STEP_M * 2,
        },
      },
      room
    )
  }
  for (let attempt = 0; attempt < NUDGE_ATTEMPTS && hits(position); attempt++) {
    position = clampToRoom(
      {
        ...item,
        position: {
          x: position.x + inward.x * SNAP_STEP_M * 2,
          z: position.z + inward.z * SNAP_STEP_M * 2,
        },
      },
      room
    )
  }
  return position
}

function clampToRoom(item: WorkItem, room: RoomPreset): Vec2 {
  const { hw, hd } = rotatedExtents(item)
  const maxX = Math.max(0, room.width / 2 - hw)
  const maxZ = Math.max(0, room.depth / 2 - hd)
  return {
    x: Math.min(maxX, Math.max(-maxX, item.position.x)),
    z: Math.min(maxZ, Math.max(-maxZ, item.position.z)),
  }
}
