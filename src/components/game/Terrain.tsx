'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

const TERRAIN_SIZE = 10000
const SEGMENTS = 64 // Reduced from 128

export default function Terrain({ timeOfDay }: { timeOfDay: 'day' | 'night' }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS)
    const positions = geo.attributes.position
    const colors = new Float32Array(positions.count * 3)

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const z = positions.getY(i)

      // Keep runway area flat
      if (Math.abs(x) < 200 && Math.abs(z) < 1700) {
        positions.setZ(i, 0)
        colors[i * 3] = 0.15
        colors[i * 3 + 1] = 0.45
        colors[i * 3 + 2] = 0.1
        continue
      }

      const scale = 0.001
      const height =
        Math.sin(x * scale * 3) * Math.cos(z * scale * 2) * 50 +
        Math.sin(x * scale * 7 + 1) * Math.cos(z * scale * 5 + 2) * 25 +
        Math.sin(x * scale * 0.5) * Math.cos(z * scale * 0.3) * 150

      const h = Math.max(0, height)
      positions.setZ(i, h)

      if (h < 2) {
        colors[i * 3] = 0.12
        colors[i * 3 + 1] = 0.4
        colors[i * 3 + 2] = 0.08
      } else if (h < 40) {
        const t = h / 40
        colors[i * 3] = 0.1 + t * 0.1
        colors[i * 3 + 1] = 0.35 + t * 0.1
        colors[i * 3 + 2] = 0.05
      } else if (h < 100) {
        const t = (h - 40) / 60
        colors[i * 3] = 0.3 + t * 0.2
        colors[i * 3 + 1] = 0.25 + t * 0.1
        colors[i * 3 + 2] = 0.1
      } else {
        const t = Math.min(1, (h - 100) / 80)
        colors[i * 3] = 0.5 + t * 0.5
        colors[i * 3 + 1] = 0.5 + t * 0.5
        colors[i * 3 + 2] = 0.5 + t * 0.5
      }

      if (timeOfDay === 'night') {
        colors[i * 3] *= 0.2
        colors[i * 3 + 1] *= 0.2
        colors[i * 3 + 2] *= 0.25
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [timeOfDay])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
      <meshLambertMaterial vertexColors side={THREE.FrontSide} />
    </mesh>
  )
}
