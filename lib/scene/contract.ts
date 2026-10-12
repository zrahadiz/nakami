// T3: shared scene contract — single source of truth for the scene coordinate
// system, unit convention, room presets, and layout shapes. The agent tool
// (T6) and the 3D components (T8+) both build on this module.
//
// Coordinate system:
// - Right-handed, Y up. The floor plane is y = 0 (FLOOR_Y); nothing is placed
//   below it.
// - The room is centered on the origin: x spans [-width/2, +width/2] and
//   z spans [-depth/2, +depth/2]. X is the room width, Z is the room depth.
// - Walls: "north" is z = -depth/2, "east" is x = +width/2,
//   "south" is z = +depth/2, "west" is x = -width/2.
// - Yaw (rotationY) is radians around +Y. 0 faces +Z (south); positive yaw
//   rotates toward +X (east), matching Math.atan2(dx, dz).
// - All distances are meters. DimensionEstimate values are centimeters and
//   must go through cmToM() before they enter the scene.

/** The floor plane sits at y = 0. */
export const FLOOR_Y = 0
/** Items keep this much clearance from the walls, in meters. */
export const WALL_MARGIN_M = 0.15
/** Placements snap to this grid (5 cm) so runs stay reproducible. */
export const SNAP_STEP_M = 0.05

export const ROOM_TYPES = ['living-room', 'bedroom', 'dining-room', 'home-office'] as const
export type RoomType = (typeof ROOM_TYPES)[number]

export const WALLS = ['north', 'east', 'south', 'west'] as const
export type Wall = (typeof WALLS)[number]

export interface Vec2 {
  x: number
  z: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface RoomPreset {
  type: RoomType
  label: string
  /** X extent, meters. */
  width: number
  /** Z extent, meters. */
  depth: number
  /** Floor-to-ceiling height, meters. */
  height: number
  windowWall: Wall
}

export const ROOM_PRESETS: Record<RoomType, RoomPreset> = {
  'living-room': {
    type: 'living-room',
    label: 'Living room',
    width: 5.4,
    depth: 4.6,
    height: 2.7,
    windowWall: 'north',
  },
  bedroom: {
    type: 'bedroom',
    label: 'Bedroom',
    width: 4.2,
    depth: 3.8,
    height: 2.6,
    windowWall: 'north',
  },
  'dining-room': {
    type: 'dining-room',
    label: 'Dining room',
    width: 4.8,
    depth: 4.2,
    height: 2.7,
    windowWall: 'east',
  },
  'home-office': {
    type: 'home-office',
    label: 'Home office',
    width: 3.4,
    depth: 3.0,
    height: 2.5,
    windowWall: 'west',
  },
}

/** Placement role derived from the product's dimension category. */
export const ITEM_ROLES = ['seating', 'table', 'lighting', 'rug', 'storage', 'decor'] as const
export type ItemRole = (typeof ITEM_ROLES)[number]

export interface ItemPlacement {
  productId: string
  role: ItemRole
  /** Center of the footprint on the floor (y = FLOOR_Y). */
  position: Vec3
  /** Yaw in radians; 0 faces +Z (see the coordinate system note above). */
  rotationY: number
  /** Axis-aligned box in meters, converted from the product's DimensionEstimate. */
  footprint: {
    width: number
    depth: number
    height: number
  }
}

export interface SceneLayout {
  room: RoomPreset
  items: ItemPlacement[]
  notes?: string
}

/** Centimeters -> meters. DimensionEstimate values are always centimeters. */
export function cmToM(centimeters: number): number {
  return centimeters / 100
}

/** Yaw that points an item's front (+Z at rotationY = 0) at `target`. */
export function rotationToward(from: Vec2, target: Vec2): number {
  return Math.atan2(target.x - from.x, target.z - from.z)
}

/** Snap a length to the shared placement grid. */
export function snapToGrid(value: number): number {
  return Math.round(value / SNAP_STEP_M) * SNAP_STEP_M
}

/** Midpoint of a wall and the direction pointing into the room. */
export function wallAnchor(
  wall: Wall,
  room: Pick<RoomPreset, 'width' | 'depth'>
): { position: Vec2; inward: Vec2 } {
  switch (wall) {
    case 'north':
      return { position: { x: 0, z: -room.depth / 2 }, inward: { x: 0, z: 1 } }
    case 'east':
      return { position: { x: room.width / 2, z: 0 }, inward: { x: -1, z: 0 } }
    case 'south':
      return { position: { x: 0, z: room.depth / 2 }, inward: { x: 0, z: -1 } }
    case 'west':
      return { position: { x: -room.width / 2, z: 0 }, inward: { x: 1, z: 0 } }
  }
}
