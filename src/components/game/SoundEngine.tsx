'use client'

import { useEffect, useRef } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { audioEngine } from '@/lib/audio'

export default function SoundEngine() {
  const phase = useGameStore((s) => s.phase)
  const prevPhase = useRef(phase)
  const prevGear = useRef(false)
  const prevFlaps = useRef(0)
  const wasStalling = useRef(false)
  const wasOverspeeding = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Init audio on first flight
  useEffect(() => {
    if (phase === 'flying') {
      audioEngine.init()
    }
  }, [phase])

  // Stop flight loops on unmount (but not menu-music — MainMenu manages that)
  useEffect(() => {
    return () => {
      audioEngine.stop('engine-loop')
      audioEngine.stop('wind-loop')
      audioEngine.stop('stall-warning')
      audioEngine.stop('overspeed')
    }
  }, [])

  // Handle phase transitions
  useEffect(() => {
    if (phase === 'flying' && prevPhase.current !== 'flying') {
      // Starting a new flight — reset tracking
      const f = useGameStore.getState().flight
      prevGear.current = f.gearDown
      prevFlaps.current = f.flaps
      wasStalling.current = false
      wasOverspeeding.current = false
    }

    if (phase === 'crashed' && prevPhase.current === 'flying') {
      audioEngine.stopAll()
      audioEngine.play('crash')
    }

    if (phase === 'landed' && prevPhase.current === 'flying') {
      audioEngine.play('touchdown')
      audioEngine.stop('stall-warning')
      audioEngine.stop('overspeed')
      // Fade out engine after landing
      setTimeout(() => {
        audioEngine.fadeLoop('engine-loop', 0.05)
        audioEngine.fadeLoop('wind-loop', 0)
      }, 500)
    }

    if (phase === 'menu') {
      // SoundEngine is about to unmount — stop flight sounds
      // Menu music is managed by MainMenu component
      audioEngine.stop('engine-loop')
      audioEngine.stop('wind-loop')
      audioEngine.stop('stall-warning')
      audioEngine.stop('overspeed')
    }

    if (phase === 'paused') {
      audioEngine.stopAll()
    }

    if (phase === 'flying' && prevPhase.current === 'paused') {
      // Resuming — loops will restart from the update interval
    }

    prevPhase.current = phase
  }, [phase])

  // Game state audio update loop (10fps to match HUD)
  useEffect(() => {
    if (phase !== 'flying') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      const { flight, scenario } = useGameStore.getState()
      const currentPhase = useGameStore.getState().phase
      if (currentPhase !== 'flying') return

      // Engine sound — volume scales with throttle
      const engineVol = scenario?.engineFailure
        ? 0.02  // faint windmill sound on engine failure
        : 0.05 + flight.throttle * 0.35
      audioEngine.fadeLoop('engine-loop', engineVol)

      // Wind sound — volume scales with speed
      const speedRatio = Math.min(1, flight.speed / 100)
      audioEngine.fadeLoop('wind-loop', speedRatio * 0.25)

      // Gear toggle
      if (flight.gearDown !== prevGear.current) {
        audioEngine.play(flight.gearDown ? 'gear-down' : 'gear-up')
        prevGear.current = flight.gearDown
      }

      // Flaps change
      if (flight.flaps !== prevFlaps.current) {
        audioEngine.play('flaps')
        prevFlaps.current = flight.flaps
      }

      // Stall warning
      const isStalling = flight.speed < 30 && !flight.onGround
      if (isStalling && !wasStalling.current) {
        audioEngine.play('stall-warning', 0.7)
      } else if (!isStalling && wasStalling.current) {
        audioEngine.stop('stall-warning')
      }
      wasStalling.current = isStalling

      // Overspeed warning
      const isOverspeeding = flight.speed > 110
      if (isOverspeeding && !wasOverspeeding.current) {
        audioEngine.play('overspeed', 0.5)
      } else if (!isOverspeeding && wasOverspeeding.current) {
        audioEngine.stop('overspeed')
      }
      wasOverspeeding.current = isOverspeeding
    }, 100)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [phase])

  return null
}
