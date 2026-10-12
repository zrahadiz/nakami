import { describe, expect, test } from 'bun:test'
import {
  FLOOR_Y,
  ROOM_PRESETS,
  ROOM_TYPES,
  SNAP_STEP_M,
  WALL_MARGIN_M,
  WALLS,
  cmToM,
  rotationToward,
  snapToGrid,
  wallAnchor,
} from './contract'

describe('scene coordinate + unit contract', () => {
  test('floor plane is y = 0', () => {
    expect(FLOOR_Y).toBe(0)
  })

  test('spacing conventions are positive', () => {
    expect(SNAP_STEP_M).toBe(0.05)
    expect(WALL_MARGIN_M).toBeGreaterThan(0)
  })

  test('cmToM converts DimensionEstimate centimeters to meters', () => {
    expect(cmToM(0)).toBe(0)
    expect(cmToM(100)).toBe(1)
    expect(cmToM(42)).toBe(0.42)
    expect(cmToM(250)).toBe(2.5)
  })

  test('every room type has a valid preset', () => {
    for (const type of ROOM_TYPES) {
      const preset = ROOM_PRESETS[type]
      expect(preset.type).toBe(type)
      expect(preset.width).toBeGreaterThan(0)
      expect(preset.depth).toBeGreaterThan(0)
      expect(preset.height).toBeGreaterThan(0)
      expect(WALLS).toContain(preset.windowWall)
    }
  })

  test('rotationToward follows the +Z-is-zero convention', () => {
    const origin = { x: 0, z: 0 }
    expect(rotationToward(origin, { x: 0, z: 1 })).toBeCloseTo(0)
    expect(rotationToward(origin, { x: 1, z: 0 })).toBeCloseTo(Math.PI / 2)
    expect(rotationToward(origin, { x: 0, z: -1 })).toBeCloseTo(Math.PI)
    expect(rotationToward(origin, { x: 1, z: 1 })).toBeCloseTo(Math.PI / 4)
  })

  test('snapToGrid rounds to the 5 cm grid', () => {
    expect(snapToGrid(0.02)).toBeCloseTo(0)
    expect(snapToGrid(0.03)).toBeCloseTo(0.05)
    expect(snapToGrid(1.27)).toBeCloseTo(1.25)
    expect(snapToGrid(2.5)).toBeCloseTo(2.5)
  })

  test('wallAnchor returns the midpoint and inward direction', () => {
    const room = { width: 5.4, depth: 4.6 }
    expect(wallAnchor('north', room)).toEqual({
      position: { x: 0, z: -2.3 },
      inward: { x: 0, z: 1 },
    })
    expect(wallAnchor('east', room)).toEqual({
      position: { x: 2.7, z: 0 },
      inward: { x: -1, z: 0 },
    })
    expect(wallAnchor('south', room)).toEqual({
      position: { x: 0, z: 2.3 },
      inward: { x: 0, z: -1 },
    })
    expect(wallAnchor('west', room)).toEqual({
      position: { x: -2.7, z: 0 },
      inward: { x: 1, z: 0 },
    })
  })
})
