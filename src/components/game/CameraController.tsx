'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/stores/gameStore'

const CHASE_BEHIND = 25
const CHASE_UP = 10
const COCKPIT_OFFSET = new THREE.Vector3(0, 1.2, 2.5)
const SMOOTH_FACTOR = 4

export default function CameraController() {
  const { camera } = useThree()
  const cameraMode = useGameStore((s) => s.cameraMode)
  const flight = useGameStore((s) => s.flight)
  const targetPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    const quat = new THREE.Quaternion().setFromEuler(flight.rotation)

    if (cameraMode === 'chase') {
      // Chase camera: behind in aircraft frame, above in world frame
      const behind = new THREE.Vector3(0, 0, -CHASE_BEHIND).applyQuaternion(quat)
      targetPos.current.copy(flight.position).add(behind)
      targetPos.current.y += CHASE_UP

      // Look at a point slightly above and ahead of the aircraft
      const lookAhead = new THREE.Vector3(0, 0, 5).applyQuaternion(quat)
      targetLook.current.copy(flight.position).add(lookAhead)
      targetLook.current.y += 2
    } else {
      // Cockpit camera: inside the aircraft looking forward
      const offset = COCKPIT_OFFSET.clone().applyQuaternion(quat)
      targetPos.current.copy(flight.position).add(offset)

      const lookForward = new THREE.Vector3(0, 0, 100).applyQuaternion(quat)
      targetLook.current.copy(flight.position).add(lookForward)
    }

    // Smooth follow
    const smoothDt = Math.min(1, SMOOTH_FACTOR * dt)
    camera.position.lerp(targetPos.current, smoothDt)

    // Smooth look
    const currentLook = new THREE.Vector3()
    camera.getWorldDirection(currentLook)
    currentLook.multiplyScalar(100).add(camera.position)
    currentLook.lerp(targetLook.current, smoothDt)
    camera.lookAt(currentLook)

    // Slight camera shake based on speed (frame-rate independent)
    if (cameraMode === 'chase') {
      const shake = flight.speed * 0.0003 * Math.min(dt * 60, 2)
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
    }
  })

  return null
}
