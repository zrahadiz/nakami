'use client'

// components/workspace/scene-3d.tsx
//
// Places the generated GLB models side by side in one orbitable scene.
// Models are scaled to a common size (NOT real-world scale), arranged on a grid,
// and the camera frames them automatically.
//
// Needs: npm i three @react-three/fiber @react-three/drei && npm i -D @types/three

import { Component, Suspense, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Bounds, ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei'

export type SceneItem = { id: string; name: string; url: string }

const TARGET = 1.6 // every model is fitted into a cube this big
const GAP = 2.3

function Model({ url, name }: { url: string; name: string }) {
  const gltf = useGLTF(url)

  const { object, scale, offset, height } = useMemo(() => {
    const object = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const max = Math.max(size.x, size.y, size.z) || 1

    return {
      object,
      scale: TARGET / max,
      // Center on x/z and sit the model on the floor.
      offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
      height: size.y,
    }
  }, [gltf.scene])

  return (
    <>
      <group scale={scale}>
        <primitive object={object} position={offset} />
      </group>

      <Html position={[0, height * scale + 0.25, 0]} center zIndexRange={[10, 0]}>
        <span className="pointer-events-none whitespace-nowrap rounded-full bg-black/65 px-2.5 py-1 text-[11px] text-white backdrop-blur">
          {name}
        </span>
      </Html>
    </>
  )
}

/** If one GLB fails to load, show a red wireframe box instead of breaking the whole scene. */
class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#B3261E" wireframe />
        </mesh>
      )
    }
    return this.props.children
  }
}

export default function Scene3D({ items }: { items: SceneItem[] }) {
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(items.length))))
  const rows = Math.ceil(items.length / cols)

  return (
    <Canvas camera={{ position: [0, 3, 7], fov: 40 }} dpr={[1, 2]}>
      <hemisphereLight args={['#ffffff', '#8a8070', 1.1]} />
      <directionalLight position={[4, 7, 4]} intensity={1.8} />
      <directionalLight position={[-5, 3, -3]} intensity={0.6} />

      <Suspense
        fallback={
          <Html center>
            <span className="whitespace-nowrap text-sm text-white/80">Loading models…</span>
          </Html>
        }
      >
        <Bounds fit clip observe margin={1.35}>
          <group>
            {items.map((item, i) => {
              const col = i % cols
              const row = Math.floor(i / cols)
              const inRow = Math.min(cols, items.length - row * cols)
              const x = (col - (inRow - 1) / 2) * GAP
              const z = (row - (rows - 1) / 2) * GAP

              return (
                <group key={item.id} position={[x, 0, z]}>
                  <ModelBoundary>
                    <Model url={item.url} name={item.name} />
                  </ModelBoundary>
                </group>
              )
            })}
          </group>
        </Bounds>

        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={14} blur={2.6} far={3} />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  )
}