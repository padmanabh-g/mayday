'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RUNWAY } from '@/types/game'

function PAPILights({ side }: { side: 'left' | 'right' }) {
  const x = side === 'left' ? -RUNWAY.WIDTH / 2 - 8 : RUNWAY.WIDTH / 2 + 8
  const z = RUNWAY.THRESHOLD_Z + 300

  return (
    <group position={[x, 0.5, z]}>
      {[0, 2, 4, 6].map((offset, i) => (
        <mesh key={i} position={[0, 0, offset]}>
          <boxGeometry args={[1, 0.5, 1]} />
          <meshBasicMaterial color={i < 2 ? '#ff3333' : '#ffffff'} />
        </mesh>
      ))}
    </group>
  )
}

// Use instanced mesh for all runway edge lights instead of individual meshes+pointLights
function RunwayEdgeLights() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const { count, color } = useMemo(() => {
    const positions: [number, number, number][] = []
    // Edge lights (every 120m instead of 60m)
    for (let z = RUNWAY.THRESHOLD_Z; z <= RUNWAY.END_Z; z += 120) {
      positions.push([-RUNWAY.WIDTH / 2 - 1, 0.3, z])
      positions.push([RUNWAY.WIDTH / 2 + 1, 0.3, z])
    }
    // Threshold lights (every 5m instead of 3m)
    for (let x = -RUNWAY.WIDTH / 2; x <= RUNWAY.WIDTH / 2; x += 5) {
      positions.push([x, 0.3, RUNWAY.THRESHOLD_Z])
    }

    const dummy = new THREE.Object3D()
    const color = new Float32Array(positions.length * 3)

    // We'll set matrices after the ref is ready
    setTimeout(() => {
      if (!meshRef.current) return
      positions.forEach((pos, i) => {
        dummy.position.set(...pos)
        dummy.updateMatrix()
        meshRef.current!.setMatrixAt(i, dummy.matrix)

        // Threshold lights are green, edge lights are yellow
        const isThreshold = pos[2] === RUNWAY.THRESHOLD_Z
        color[i * 3] = isThreshold ? 0 : 1
        color[i * 3 + 1] = isThreshold ? 1 : 1
        color[i * 3 + 2] = isThreshold ? 0.3 : 0.5
      })
      meshRef.current.instanceMatrix.needsUpdate = true
    }, 0)

    return { count: positions.length, color }
  }, [])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.3, 6, 4]} />
      <meshBasicMaterial color="#ffff88" />
    </instancedMesh>
  )
}

export default function Runway({ timeOfDay }: { timeOfDay: 'day' | 'night' }) {
  // Centerline markings - reduce count
  const centerlineMarks = useMemo(() => {
    const marks: number[] = []
    for (let z = RUNWAY.THRESHOLD_Z + 100; z < RUNWAY.END_Z - 100; z += 100) {
      marks.push(z)
    }
    return marks
  }, [])

  return (
    <group>
      {/* Runway surface */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RUNWAY.WIDTH, RUNWAY.LENGTH]} />
        <meshLambertMaterial color="#333333" />
      </mesh>

      {/* Runway border lines */}
      <mesh position={[-RUNWAY.WIDTH / 2 + 0.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, RUNWAY.LENGTH]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[RUNWAY.WIDTH / 2 - 0.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, RUNWAY.LENGTH]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Centerline dashes */}
      {centerlineMarks.map((z, i) => (
        <mesh key={i} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 30]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Threshold markings */}
      {[-15, -12, -9, -6, -3, 3, 6, 9, 12, 15].map((x, i) => (
        <mesh key={i} position={[x, 0.02, RUNWAY.THRESHOLD_Z + 30]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, 45]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Runway number area */}
      <mesh position={[0, 0.02, RUNWAY.THRESHOLD_Z + 100]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 15]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>

      {/* Touchdown zone markers */}
      {[300, 400, 500].map((offset, i) => (
        <group key={i}>
          <mesh position={[-8, 0.02, RUNWAY.THRESHOLD_Z + offset]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 20]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[8, 0.02, RUNWAY.THRESHOLD_Z + offset]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 20]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}

      {/* PAPI lights */}
      <PAPILights side="left" />
      <PAPILights side="right" />

      {/* Instanced runway lights - no pointLights! */}
      <RunwayEdgeLights />

      {/* Taxiway */}
      <mesh position={[RUNWAY.WIDTH / 2 + 40, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 800]} />
        <meshLambertMaterial color="#444444" />
      </mesh>

      {/* Taxiway connector */}
      <mesh position={[RUNWAY.WIDTH / 2 + 20, 0.01, 200]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 25]} />
        <meshLambertMaterial color="#444444" />
      </mesh>

      {/* Control Tower */}
      <group position={[RUNWAY.WIDTH / 2 + 80, 0, -200]}>
        <mesh position={[0, 5, 0]}>
          <boxGeometry args={[20, 10, 15]} />
          <meshLambertMaterial color="#888888" />
        </mesh>
        <mesh position={[0, 17.5, 0]}>
          <boxGeometry args={[8, 15, 8]} />
          <meshLambertMaterial color="#999999" />
        </mesh>
        <mesh position={[0, 27, 0]}>
          <boxGeometry args={[12, 4, 12]} />
          <meshBasicMaterial
            color={timeOfDay === 'night' ? '#225588' : '#225588'}
          />
        </mesh>
        <mesh position={[0, 30, 0]}>
          <boxGeometry args={[14, 1, 14]} />
          <meshLambertMaterial color="#666666" />
        </mesh>
      </group>
    </group>
  )
}
