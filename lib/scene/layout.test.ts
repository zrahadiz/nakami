import { beforeEach, describe, expect, test } from 'bun:test'
import { rememberProducts } from '@/lib/product-registry'
import { estimateDimensionsFromTitles } from '@/lib/agent/dimensions'
import { ROOM_PRESETS, cmToM, rotationToward, wallAnchor } from './contract'
import { buildSceneLayout } from './layout'

// Fixture products registered the way searchProducts() would: category keys
// match the dimension table, so estimateDimensionsForProducts resolves boxes.
const REGISTRY_PRODUCTS = [
  { id: 'test-sofa', title: 'Three Seat Sofa', category: 'sofa' },
  { id: 'test-armchair', title: 'Tan Leather Armchair', category: 'armchair' },
  { id: 'test-coffee-table', title: 'Oak Coffee Table', category: 'coffee table' },
  { id: 'test-rug', title: 'Wool Rug', category: 'rug' },
  { id: 'test-floor-lamp', title: 'Arc Floor Lamp', category: 'floor lamp' },
  { id: 'test-plant', title: 'Fiddle Leaf Plant', category: 'plant' },
  { id: 'test-art', title: 'Abstract Print', category: 'wall art' },
  { id: 'test-sideboard', title: 'Walnut Sideboard', category: 'sideboard' },
]

const LIVING_ROOM_IDS = REGISTRY_PRODUCTS.map((p) => p.id)

beforeEach(() => {
  rememberProducts(REGISTRY_PRODUCTS)
})

function rotatedExtents(item: {
  footprint: { width: number; depth: number }
  rotationY: number
}) {
  const cos = Math.abs(Math.cos(item.rotationY))
  const sin = Math.abs(Math.sin(item.rotationY))
  return {
    hw: (item.footprint.width * cos + item.footprint.depth * sin) / 2,
    hd: (item.footprint.width * sin + item.footprint.depth * cos) / 2,
  }
}

describe('buildSceneLayout', () => {
  test('assigns roles and converts centimeter estimates to meters', () => {
    const layout = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType: 'living-room' })

    const byId = new Map(layout.items.map((item) => [item.productId, item]))
    expect(byId.get('test-sofa')?.role).toBe('seating')
    expect(byId.get('test-coffee-table')?.role).toBe('table')
    expect(byId.get('test-floor-lamp')?.role).toBe('lighting')
    expect(byId.get('test-rug')?.role).toBe('rug')
    expect(byId.get('test-sideboard')?.role).toBe('storage')
    expect(byId.get('test-art')?.role).toBe('decor')

    // sofa box from the dimension table: 210 x 90 x 80 cm -> 2.1 x 0.9 x 0.8 m
    expect(byId.get('test-sofa')?.footprint).toEqual({
      width: cmToM(210),
      depth: cmToM(90),
      height: cmToM(80),
    })
  })

  test('seating faces the window', () => {
    const layout = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType: 'living-room' })
    const room = ROOM_PRESETS['living-room']
    const windowMid = wallAnchor(room.windowWall, room).position

    for (const seat of layout.items.filter((item) => item.role === 'seating')) {
      const toward = {
        x: windowMid.x - seat.position.x,
        z: windowMid.z - seat.position.z,
      }
      const facing = { x: Math.sin(seat.rotationY), z: Math.cos(seat.rotationY) }
      const dot = toward.x * facing.x + toward.z * facing.z
      expect(dot).toBeGreaterThan(0)
      // and the engine's rotation convention is rotationToward(). The small
      // tolerance covers the final 5 cm grid snap (<= 2.5 cm per axis).
      expect(seat.rotationY).toBeCloseTo(
        rotationToward({ x: seat.position.x, z: seat.position.z }, windowMid),
        1
      )
    }
  })

  test('keeps every item inside the room bounds', () => {
    for (const roomType of ['living-room', 'dining-room', 'home-office'] as const) {
      const layout = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType })
      for (const item of layout.items) {
        expect(Math.abs(item.position.x)).toBeLessThanOrEqual(layout.room.width / 2 + 0.001)
        expect(Math.abs(item.position.z)).toBeLessThanOrEqual(layout.room.depth / 2 + 0.001)
      }
    }
  })

  test('places the rug under the seating + table group', () => {
    const layout = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType: 'living-room' })
    const group = layout.items.filter(
      (item) => item.role === 'seating' || item.role === 'table'
    )
    const rug = layout.items.find((item) => item.role === 'rug')
    expect(rug).toBeDefined()

    const cx = group.reduce((sum, item) => sum + item.position.x, 0) / group.length
    const cz = group.reduce((sum, item) => sum + item.position.z, 0) / group.length
    expect(rug!.position.x).toBeCloseTo(cx, 1)
    expect(rug!.position.z).toBeCloseTo(cz, 1)
    expect(rug!.position.y).toBe(0)
  })

  test('lifts wall art off the floor and keeps floor items grounded', () => {
    const layout = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType: 'living-room' })
    const art = layout.items.find((item) => item.productId === 'test-art')
    expect(art!.position.y).toBeGreaterThan(0)
    for (const item of layout.items.filter((i) => i.role !== 'decor')) {
      expect(item.position.y).toBe(0)
    }
  })

  test('floor items do not overlap', () => {
    const layout = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType: 'living-room' })
    const floorItems = layout.items.filter((item) => item.role !== 'rug' && item.position.y === 0)
    for (let i = 0; i < floorItems.length; i++) {
      for (let j = i + 1; j < floorItems.length; j++) {
        const a = floorItems[i]
        const b = floorItems[j]
        const aBox = rotatedExtents(a)
        const bBox = rotatedExtents(b)
        const gapX = aBox.hw + bBox.hw - Math.abs(a.position.x - b.position.x)
        const gapZ = aBox.hd + bBox.hd - Math.abs(a.position.z - b.position.z)
        // Separated on at least one axis (the 2 cm anti-overlap padding is fine).
        expect(gapX <= 0.021 || gapZ <= 0.021).toBe(true)
      }
    }
  })

  test('is deterministic', () => {
    const first = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType: 'living-room' })
    const second = buildSceneLayout({ productIds: LIVING_ROOM_IDS, roomType: 'living-room' })
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  test('unknown products fall back to the default box as decor', () => {
    const layout = buildSceneLayout({ productIds: ['not-in-registry'], roomType: 'bedroom' })
    const item = layout.items[0]
    expect(item.role).toBe('decor')
    expect(item.footprint).toEqual({ width: 0.6, depth: 0.6, height: 0.75 })
  })

  test('empty input yields the room preset and no items', () => {
    const layout = buildSceneLayout({ productIds: [], roomType: 'home-office' })
    expect(layout.items).toEqual([])
    expect(layout.room).toEqual(ROOM_PRESETS['home-office'])
  })

  test('accepts pre-resolved estimates (client path, titles instead of the registry)', () => {
    const layout = buildSceneLayout({
      productIds: ['user-chair', 'user-rug'],
      roomType: 'living-room',
      estimates: estimateDimensionsFromTitles([
        { productId: 'user-chair', title: 'Walnut Lounge Chair' },
        { productId: 'user-rug', title: 'Hand-Woven Jute Rug' },
      ]),
    })

    const byId = new Map(layout.items.map((item) => [item.productId, item]))
    // "chair" resolves to the armchair box through the synonym fallback.
    expect(byId.get('user-chair')?.role).toBe('seating')
    expect(byId.get('user-chair')?.footprint).toEqual({
      width: cmToM(85),
      depth: cmToM(80),
      height: cmToM(90),
    })
    expect(byId.get('user-rug')?.role).toBe('rug')
  })
})
