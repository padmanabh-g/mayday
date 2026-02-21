'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useGameStore } from '@/stores/gameStore'

export default function KeyboardControls({ isImmersive = false }: { isImmersive?: boolean }) {
  const setControl = useGameStore((s) => s.setControl)
  const toggleCamera = useGameStore((s) => s.toggleCamera)
  const toggleGear = useGameStore((s) => s.toggleGear)
  const setFlaps = useGameStore((s) => s.setFlaps)
  const setBraking = useGameStore((s) => s.setBraking)
  const setPhase = useGameStore((s) => s.setPhase)
  const phase = useGameStore((s) => s.phase)

  // Track which keys are currently held to prevent repeat-triggered toggles
  const heldKeys = useRef(new Set<string>())

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // In immersive mode, pointer lock API handles Escape → pause
      // Only handle Escape manually in non-immersive fallback
      if (e.key === 'Escape' && !isImmersive) {
        if (phase === 'flying') setPhase('paused')
        else if (phase === 'paused') setPhase('flying')
        return
      }

      // All other controls only work while flying
      if (phase !== 'flying') return

      // Prevent browser default for all game keys during flight
      const gameKeys = new Set([
        'w', 's', 'a', 'd', 'q', 'e', 'g', 'f', 'b', 'v',
        'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
        'shift', 'control', '[', ']', ' ', 'tab',
      ])
      if (gameKeys.has(key)) {
        e.preventDefault()
      }

      // Prevent key-repeat for held controls
      if (heldKeys.current.has(key)) return
      heldKeys.current.add(key)

      switch (key) {
        // W/Up = nose UP (climb) — more intuitive for gamers
        case 'w':
        case 'arrowup':
          setControl('pitchUp', true)
          break
        // S/Down = nose DOWN (dive)
        case 's':
        case 'arrowdown':
          setControl('pitchDown', true)
          break
        case 'a':
        case 'arrowleft':
          setControl('rollLeft', true)
          break
        case 'd':
        case 'arrowright':
          setControl('rollRight', true)
          break
        case 'q':
          setControl('yawLeft', true)
          break
        case 'e':
          setControl('yawRight', true)
          break
        case 'shift':
          setControl('throttleUp', true)
          break
        case 'control':
          setControl('throttleDown', true)
          break
        case 'g':
          toggleGear()
          break
        case 'f': {
          // F cycles flaps: 0 → 1 → 2 → 3 → 0
          const currentFlaps = useGameStore.getState().flight.flaps
          if (currentFlaps >= 3) {
            setFlaps(-3) // wrap back to 0
          } else {
            setFlaps(1)
          }
          break
        }
        case '[':
          setFlaps(-1)
          break
        case ']':
          setFlaps(1)
          break
        case 'b':
          setBraking(true)
          break
        case 'v':
          toggleCamera()
          break
      }
    },
    [phase, setControl, toggleCamera, toggleGear, setFlaps, setBraking, setPhase, isImmersive]
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      heldKeys.current.delete(key)

      switch (key) {
        case 'w':
        case 'arrowup':
          setControl('pitchUp', false)
          break
        case 's':
        case 'arrowdown':
          setControl('pitchDown', false)
          break
        case 'a':
        case 'arrowleft':
          setControl('rollLeft', false)
          break
        case 'd':
        case 'arrowright':
          setControl('rollRight', false)
          break
        case 'q':
          setControl('yawLeft', false)
          break
        case 'e':
          setControl('yawRight', false)
          break
        case 'shift':
          setControl('throttleUp', false)
          break
        case 'control':
          setControl('throttleDown', false)
          break
        case 'b':
          setBraking(false)
          break
      }
    },
    [setControl, setBraking]
  )

  // Release all controls on window blur (alt-tab, focus loss)
  const handleBlur = useCallback(() => {
    heldKeys.current.clear()
    setControl('pitchUp', false)
    setControl('pitchDown', false)
    setControl('rollLeft', false)
    setControl('rollRight', false)
    setControl('yawLeft', false)
    setControl('yawRight', false)
    setControl('throttleUp', false)
    setControl('throttleDown', false)
    setBraking(false)
  }, [setControl, setBraking])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [handleKeyDown, handleKeyUp, handleBlur])

  return null
}
