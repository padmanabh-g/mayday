'use client'

import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useGameStore } from '@/stores/gameStore'

const MODEL_PATH = '/models/airplane.glb'
const MODEL_SCALE = 0.0045

export default function Aircraft() {
  const meshRef = useRef<THREE.Group>(null)
  const flight = useGameStore((s) => s.flight)
  const cameraMode = useGameStore((s) => s.cameraMode)
  const { scene } = useGLTF(MODEL_PATH)

  const model = useMemo(() => {
    const clone = scene.clone(true)
    // Center the model at origin
    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    clone.position.sub(center)
    return clone
  }, [scene])

  useFrame(() => {
    if (!meshRef.current) return
    meshRef.current.position.copy(flight.position)
    meshRef.current.rotation.copy(flight.rotation)
  })

  if (cameraMode === 'cockpit') return null

  return (
    <group ref={meshRef}>
      {/* Loaded airplane model - converter handled Z-up to Y-up, rotate nose from +X to +Z */}
      <group
        rotation={[0, -Math.PI / 2, 0]}
        scale={MODEL_SCALE}
      >
        <primitive object={model} />
      </group>

      {/* Navigation lights */}
      <mesh position={[-7, 0, 0]}>
        <sphereGeometry args={[0.1, 4, 4]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh position={[7, 0, 0]}>
        <sphereGeometry args={[0.1, 4, 4]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
      <mesh position={[0, 0, -6]}>
        <sphereGeometry args={[0.1, 4, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
