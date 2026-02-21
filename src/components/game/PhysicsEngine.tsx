'use client'

import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/stores/gameStore'
import { updatePhysics, calculateLandingScore } from '@/lib/physics'
import { useRef, useEffect } from 'react'

export default function PhysicsEngine() {
  const flight = useGameStore((s) => s.flight)
  const controls = useGameStore((s) => s.controls)
  const scenario = useGameStore((s) => s.scenario)
  const phase = useGameStore((s) => s.phase)
  const updateFlight = useGameStore((s) => s.updateFlight)
  const setPhase = useGameStore((s) => s.setPhase)
  const setLandingScore = useGameStore((s) => s.setLandingScore)
  const setElapsedTime = useGameStore((s) => s.setElapsedTime)

  const prevOnGround = useRef(false)
  const approachTracking = useRef({ speed: 0, angle: 0 })
  const hasLanded = useRef(false)

  // Reset refs when a new flight starts
  useEffect(() => {
    if (phase === 'flying') {
      prevOnGround.current = false
      approachTracking.current = { speed: 0, angle: 0 }
      hasLanded.current = false
    }
  }, [phase])

  useFrame((_, dt) => {
    if (phase !== 'flying' || hasLanded.current) return

    // Track approach data before landing
    if (!flight.onGround && flight.altitude < 200) {
      approachTracking.current.speed = flight.speed
      if (flight.verticalSpeed !== 0 && flight.speed > 10) {
        const horizontalSpeed = Math.sqrt(
          flight.velocity.x ** 2 + flight.velocity.z ** 2
        )
        approachTracking.current.angle =
          Math.abs(Math.atan2(-flight.verticalSpeed, horizontalSpeed) * (180 / Math.PI))
      }
    }

    // Update physics
    const updates = updatePhysics(flight, controls, dt, scenario)
    updateFlight(updates)

    // Update elapsed time
    setElapsedTime(useGameStore.getState().elapsedTime + dt)

    // Detect ground contact (transition from air to ground)
    const justTouchedDown = updates.onGround && !prevOnGround.current
    prevOnGround.current = updates.onGround ?? false

    if (!justTouchedDown) return

    // Prevent any further landing/crash detection this flight
    hasLanded.current = true

    // Use the updated values (post-physics) for scoring
    const touchdownVS = updates.verticalSpeed ?? flight.verticalSpeed
    const touchdownX = updates.position?.x ?? flight.position.x

    if (updates.crashed) {
      // Crash — still calculate score for feedback
      const score = calculateLandingScore(
        touchdownVS,
        touchdownX,
        approachTracking.current.speed,
        approachTracking.current.angle
      )
      // Force grade to Crash
      score.grade = 'Crash'
      setLandingScore(score)
      setPhase('crashed')
    } else {
      // Successful landing — score it
      const score = calculateLandingScore(
        touchdownVS,
        touchdownX,
        approachTracking.current.speed,
        approachTracking.current.angle
      )
      setLandingScore(score)
      if (score.grade === 'Crash') {
        setPhase('crashed')
      } else {
        setPhase('landed')
      }
    }
  })

  return null
}
