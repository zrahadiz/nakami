'use client'

// components/workspace/product-model.tsx
//
// T9: the two states of one furniture item in the preview scene, with a
// placeholder→model crossfade.
//
//   ProductPlaceholder — a textured quad (the product photo) standing in the
//     layout footprint, used while the GLB is generating or failed.
//   ProductModel      — the generated GLB (Draco-decoded), normalized: largest
//     dimension scaled to the footprint estimate, centered on x/z, resting on
//     the floor (y = 0). Materials are cloned per instance so the crossfade
//     can animate their opacity without touching drei's GLTF cache.
//
// The SceneCanvas (T10) drives the crossfade by owning the placeholder/model
// bookkeeping; the fade lerp itself runs per frame in ProductFurniture.
// Selection is highlighted with drei <Outlines> on the placeholder.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Outlines, useGLTF } from '@react-three/drei'

import type { ItemPlacement } from '@/lib/scene/contract'

const FALLBACK_COLORS = ['#D9CFBC', '#C9A27A', '#B9A58B', '#7A8B6F']

function fallbackColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length]
}

/** Sets every mesh material under `root` to `opacity` (and hides the subtree
 * past the fade floor). Remembers each material's own transparency so a fully
 * faded-in model can drop the transparent flag again (avoids sorting artifacts). */
function applyOpacity(root: THREE.Object3D, opacity: number) {
  root.visible = opacity > 0.015
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!material) continue
      const original = (material.userData.__originalTransparent as boolean | undefined) ??
        material.transparent
      material.userData.__originalTransparent = original
      material.transparent = original || opacity < 1
      material.opacity = Math.min(1, opacity)
    }
  })
}

/* ---------- placeholder (textured quad) ---------- */

export function ProductPlaceholder({
  placement,
  imageUrl,
  selected,
}: {
  placement: ItemPlacement
  imageUrl: string
  selected: boolean
}) {
  const { width, depth, height } = placement.footprint
  const tone = fallbackColor(placement.productId)
  // Rugs and thin decor read better as a flat plane than a standing quad.
  const flat = placement.role === 'rug' || height <= 0.05

  if (flat) {
    return (
      <group>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} castShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color={tone} roughness={0.9} transparent />
          {selected && <Outlines thickness={2.5} color="#D9623B" screenspace />}
        </mesh>
      </group>
    )
  }

  return (
    <group>
      {/* base slab grounds the quad on the floor */}
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.02, depth]} />
        <meshStandardMaterial color={tone} roughness={0.9} transparent />
      </mesh>
      {/* photo quad — inherits the item's layout yaw from the parent group */}
      <mesh position={[0, height / 2 + 0.02, 0]} castShadow>
        <planeGeometry args={[Math.max(0.1, width), Math.max(0.1, height)]} />
        {imageUrl ? (
          <ImageMaterial url={imageUrl} tone={tone} />
        ) : (
          <meshStandardMaterial color={tone} roughness={0.85} transparent />
        )}
        {selected && <Outlines thickness={2.5} color="#D9623B" screenspace />}
      </mesh>
    </group>
  )
}

/** Loads a product photo into a texture; degrades to the tinted material on
 * failure (external retailer images often lack CORS headers). */
function ImageMaterial({ url, tone }: { url: string; tone: string }) {
  const [failed, setFailed] = useState(false)

  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    return loader.load(
      url,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace
      },
      undefined,
      () => setFailed(true)
    )
  }, [url])

  // Dispose the texture when the url changes or the component unmounts.
  useEffect(() => () => texture.dispose(), [texture])

  if (failed) {
    return <meshStandardMaterial color={tone} roughness={0.85} transparent />
  }
  return <meshStandardMaterial map={texture} color="#ffffff" roughness={0.8} transparent />
}

/* ---------- model (generated GLB) ---------- */

export function ProductModel({
  placement,
  url,
  selected,
  onReady,
}: {
  placement: ItemPlacement
  url: string
  selected: boolean
  /** Fired once the GLB is mounted, so the crossfade can start. */
  onReady?: () => void
}) {
  const gltf = useGLTF(url, true)

  const prepared = useMemo(() => {
    const object = gltf.scene.clone(true)
    object.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Uniform scale so the model's largest dimension matches the footprint
    // estimate — proportions preserved, nothing below the floor.
    const modelMax = Math.max(size.x, size.y, size.z) || 1
    const targetMax = Math.max(
      placement.footprint.width,
      placement.footprint.height,
      placement.footprint.depth,
      0.05
    )
    const scale = targetMax / modelMax

    object.scale.setScalar(scale)
    object.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)

    object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      // Clone materials so fading this instance does not leak into the cache.
      const material = mesh.material as THREE.Material | THREE.Material[]
      mesh.material = Array.isArray(material)
        ? material.map((mat) => mat.clone())
        : material.clone()
      mesh.castShadow = true
      mesh.receiveShadow = true
    })

    return object
  }, [gltf.scene, placement.footprint.width, placement.footprint.height, placement.footprint.depth])

  useEffect(() => {
    onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared])

  const { width, depth } = placement.footprint
  return (
    <>
      <primitive object={prepared} />
      {/* selection ring on the floor (GLB materials are arbitrary, so no Outlines) */}
      {selected && (
        <mesh position={[0, 0.012, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[Math.max(width, depth) * 0.45, Math.max(width, depth) * 0.55, 48]} />
          <meshBasicMaterial color="#D9623B" transparent opacity={0.85} />
        </mesh>
      )}
    </>
  )
}

/* ---------- crossfade wrapper ---------- */

/** The selected product ids set is shared; selection ring/outline is drawn here. */
export function ProductFurniture({
  placement,
  imageUrl,
  url,
  selected,
  onSelect,
}: {
  placement: ItemPlacement
  imageUrl: string
  url: string | null
  selected: boolean
  onSelect?: (productId: string) => void
}) {
  const [modelMounted, setModelMounted] = useState(false)
  const rootRef = useRef<THREE.Group>(null)
  // Model opacity: lerps toward 1 once the GLB is mounted, back toward 0 otherwise.
  const fade = useRef(0)

  useFrame((_, delta) => {
    const target = url && modelMounted ? 1 : 0
    fade.current += (target - fade.current) * Math.min(1, delta * 2.5)
    const root = rootRef.current
    if (!root) return

    const [placeholder, model] = root.children as [THREE.Group, THREE.Group]
    if (placeholder) applyOpacity(placeholder, 1 - fade.current)
    if (model) applyOpacity(model, fade.current)
  })

  // Dispose the cached GLB when the url is replaced or the item unmounts —
  // never leak GLB memory.
  useEffect(() => {
    const current = url
    return () => {
      if (current) useGLTF.clear(current)
    }
  }, [url])

  return (
    <group
      ref={rootRef}
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.(placement.productId)
      }}
    >
      <ProductPlaceholder
        placement={placement}
        imageUrl={imageUrl}
        selected={selected && !modelMounted}
      />
      {url && (
        <Suspense fallback={null}>
          <ProductModel
            placement={placement}
            url={url}
            selected={selected}
            onReady={() => setModelMounted(true)}
          />
        </Suspense>
      )}
    </group>
  )
}
