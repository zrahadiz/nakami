'use client'

// components/workspace/scene-canvas.tsx
//
// T10: the 3D preview canvas. Renders the ProceduralRoom (T8) from the layout
// the build_scene_layout tool produced — the layout is read from the persisted
// chat history, so a reload restores the exact same scene — and one
// ProductFurniture (T9) per placement: the textured placeholder right away,
// crossfading into the generated GLB when its job lands via Realtime.
//
// Client-only: the PreviewTab imports this with dynamic(..., { ssr: false }),
// so three.js never reaches the server bundle or the first paint.
//
// Camera and controls are constrained around the room: orbit within a polar
// band and a distance band sized from the preset, panning disabled so the
// framed room never gets lost. `onCaptureReady` hands the caller a capture()
// that renders on demand and returns a small JPEG data URL — the SceneCornerThumb
// pins it via POST /api/threads/[id]/preview-image.

import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import { ProceduralRoom } from './procedural-room'
import { ProductFurniture } from './product-model'
import type { ItemPlacement, SceneLayout } from '@/lib/scene/contract'

export type SceneEntry = {
  productId: string
  imageUrl: string | null
  glbUrl: string | null
}

/** A JPEG data URL capture of the current frame, or null when not ready. */
export type CanvasCapture = () => string | null

/** Matches the warm backdrop the Products tab paints behind its cards. */
const BACKDROP = '#F1EBDF'
/** Longest edge of the pinned thumbnail, pixels. */
const CAPTURE_MAX_WIDTH = 640

export default function SceneCanvas({
  layout,
  entries,
  selectedProductId,
  onSelect,
  onCaptureReady,
}: {
  layout: SceneLayout
  entries: SceneEntry[]
  selectedProductId: string | null
  /** Called when the user clicks an item; null when they click empty space. */
  onSelect?: (productId: string | null) => void
  onCaptureReady?: (capture: CanvasCapture) => void
}) {
  const { room } = layout

  const glRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)

  // On-demand capture: render the frame here (not on the next tick), then
  // downscale into a scratch 2D canvas so the upload stays ~100 KB.
  const capture = useCallback<CanvasCapture>(() => {
    const gl = glRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!gl || !scene || !camera) return null

    const source = gl.domElement
    if (!source.isConnected) return null

    gl.render(scene, camera)

    const scale = Math.min(1, CAPTURE_MAX_WIDTH / source.width)
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const scratch = document.createElement('canvas')
    scratch.width = width
    scratch.height = height
    const ctx = scratch.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = BACKDROP
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(source, 0, 0, width, height)
    return scratch.toDataURL('image/jpeg', 0.75)
  }, [])

  const placements = useMemo(() => {
    const map = new Map<string, ItemPlacement>()
    for (const item of layout.items) map.set(item.productId, item)
    return map
  }, [layout.items])

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{
        position: [0, room.height * 0.85, room.depth * 0.75 + 1.6],
        fov: 42,
      }}
      onCreated={({ gl, scene, camera }) => {
        glRef.current = gl
        sceneRef.current = scene
        cameraRef.current = camera
        onCaptureReady?.(capture)
      }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <color attach="background" args={[BACKDROP]} />

      <ProceduralRoom preset={room} />

      <group>
        {entries.map((entry, index) => {
          const placement = placements.get(entry.productId)
          if (!placement) return null

          return (
            <group
              key={`${entry.productId}:${index}`}
              position={[
                placement.position.x,
                placement.position.y,
                placement.position.z,
              ]}
              rotation-y={placement.rotationY}
            >
              <ProductFurniture
                placement={placement}
                imageUrl={entry.imageUrl ?? ''}
                url={entry.glbUrl}
                selected={selectedProductId === entry.productId}
                onSelect={onSelect ? () => onSelect(entry.productId) : undefined}
              />
            </group>
          )
        })}
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, 0.7, 0]}
        minDistance={1.6}
        maxDistance={Math.max(room.width, room.depth) * 1.5 + 1.5}
        minPolarAngle={0.3}
        maxPolarAngle={1.48}
      />
    </Canvas>
  )
}
