'use client'

// components/workspace/procedural-room.tsx
//
// T8: the procedural room shell, built from the shared RoomPreset contract
// (lib/scene/contract.ts). Right-handed Y-up, floor at y = 0, room centered
// on the origin — exactly the space the layout tool (T6) places items in.
//
// Walls are inward-facing planes (invisible from outside, so orbiting past a
// wall never blocks the view), the preset's windowWall gets an emissive pane
// with a frame, and the lighting rig is hung from the window direction so
// scenes read as daylight interiors.

import * as THREE from 'three'
import { useMemo } from 'react'

import { wallAnchor, type RoomPreset, type Wall } from '@/lib/scene/contract'

const FLOOR_COLOR = '#C9BBA4' // warm oak
const WALL_COLOR = '#EFE9DE'
const BASEBOARD_COLOR = '#B7AC98'
const FRAME_COLOR = '#FFFFFF'
const PANE_COLOR = '#DCEBF7'

/** Center, rotation, and horizontal extent of one wall's inward-facing plane. */
function wallTransform(wall: Wall, preset: RoomPreset) {
  switch (wall) {
    case 'north':
      return { position: [0, preset.height / 2, -preset.depth / 2] as const, rotationY: 0, span: preset.width }
    case 'south':
      return { position: [0, preset.height / 2, preset.depth / 2] as const, rotationY: Math.PI, span: preset.width }
    case 'west':
      return { position: [-preset.width / 2, preset.height / 2, 0] as const, rotationY: Math.PI / 2, span: preset.depth }
    case 'east':
      return { position: [preset.width / 2, preset.height / 2, 0] as const, rotationY: -Math.PI / 2, span: preset.depth }
  }
}

const ALL_WALLS: Wall[] = ['north', 'east', 'south', 'west']

/** The window pane assembly, local to the window wall. */
function WindowPane({ span, wallHeight }: { span: number; wallHeight: number }) {
  const paneWidth = span * 0.44
  const paneHeight = wallHeight * 0.52
  const mullion = 0.04

  return (
    <group position={[0, wallHeight * 0.56, 0.012]}>
      {/* frame */}
      <mesh>
        <planeGeometry args={[paneWidth + 0.14, paneHeight + 0.14]} />
        <meshBasicMaterial color={FRAME_COLOR} />
      </mesh>
      {/* pane */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[paneWidth, paneHeight]} />
        <meshBasicMaterial color={PANE_COLOR} toneMapped={false} />
      </mesh>
      {/* mullions */}
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[mullion, paneHeight, 0.01]} />
        <meshBasicMaterial color={FRAME_COLOR} />
      </mesh>
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[paneWidth, mullion, 0.01]} />
        <meshBasicMaterial color={FRAME_COLOR} />
      </mesh>
    </group>
  )
}

export function ProceduralRoom({ preset }: { preset: RoomPreset }) {
  const { width, depth, height, windowWall } = preset
  const span = Math.max(width, depth)

  // Sun just outside the window wall, aimed at the room center (the default
  // directionalLight target is the origin).
  const sunPosition = useMemo(() => {
    const anchor = wallAnchor(windowWall, preset)
    return [
      anchor.position.x + anchor.inward.x * span,
      height + 1.2,
      anchor.position.z + anchor.inward.z * span,
    ] as [number, number, number]
  }, [windowWall, preset, span, height])

  return (
    <group>
      {/* floor — receives both the sun shadows and the contact shadows */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.92} metalness={0} />
      </mesh>

      {ALL_WALLS.map((wall) => {
        const t = wallTransform(wall, preset)
        return (
          <group key={wall}>
            <mesh position={t.position} rotation-y={t.rotationY} receiveShadow>
              <planeGeometry args={[t.span, height]} />
              <meshStandardMaterial color={WALL_COLOR} roughness={0.95} metalness={0} side={THREE.FrontSide} />
            </mesh>
            {/* baseboard strip along the floor edge */}
            <mesh
              position={[t.position[0], 0.05, t.position[2]]}
              rotation-y={t.rotationY}
              receiveShadow
            >
              <planeGeometry args={[t.span, 0.1]} />
              <meshStandardMaterial color={BASEBOARD_COLOR} roughness={0.8} />
            </mesh>
            {wall === windowWall && <WindowPane span={t.span} wallHeight={height} />}
          </group>
        )
      })}

      {/* lighting rig */}
      <hemisphereLight args={['#ffffff', '#B9A58B', 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        castShadow
        position={sunPosition}
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-bias={-0.0004}
      />
    </group>
  )
}
