'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'

function Clouds() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const count = 60 // Reduced from 200

  useMemo(() => {
    if (!meshRef.current) return
    const dummy = new THREE.Object3D()

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 10000
      const y = 200 + Math.random() * 400
      const z = (Math.random() - 0.5) * 10000
      const scale = 30 + Math.random() * 80

      dummy.position.set(x, y, z)
      dummy.scale.set(scale, scale * 0.3, scale * 0.6)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
    </instancedMesh>
  )
}

function Stars() {
  const positions = useMemo(() => {
    const pos = new Float32Array(1000 * 3)
    for (let i = 0; i < 1000; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.5
      const r = 4000
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) + 200
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return pos
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={2} sizeAttenuation={false} />
    </points>
  )
}

export default function Sky({ timeOfDay }: { timeOfDay: 'day' | 'night' }) {
  const isNight = timeOfDay === 'night'

  return (
    <>
      <color attach="background" args={[isNight ? '#0a0a1a' : '#87CEEB']} />
      <fog attach="fog" args={[isNight ? '#0a0a1a' : '#c8ddf0', 500, 6000]} />

      {/* Single directional light, no shadows */}
      <directionalLight
        position={isNight ? [500, 100, 300] : [1000, 800, 500]}
        intensity={isNight ? 0.2 : 1.5}
        color={isNight ? '#8888cc' : '#fffaf0'}
      />

      <ambientLight intensity={isNight ? 0.15 : 0.5} color={isNight ? '#334466' : '#ffffff'} />

      {!isNight && <Clouds />}
      {isNight && <Stars />}
    </>
  )
}
