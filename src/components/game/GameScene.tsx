'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { usePointerLock } from '@/hooks/usePointerLock'
import Terrain from './Terrain'
import Runway from './Runway'
import Aircraft from './Aircraft'
import Sky from './Sky'
import CameraController from './CameraController'
import PhysicsEngine from './PhysicsEngine'
import KeyboardControls from './KeyboardControls'
import FlightHUD from '../hud/FlightHUD'
import ATCPanel from '../atc/ATCPanel'
import PauseMenu from '../menu/PauseMenu'
import LandingCard from '../menu/LandingCard'
import WaterPlane from './WaterPlane'
import SoundEngine from './SoundEngine'
import ImmersiveOverlay from './ImmersiveOverlay'

export default function GameScene() {
  const scenario = useGameStore((s) => s.scenario)
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const timeOfDay = scenario?.timeOfDay ?? 'day'
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { isLocked, isSupported, requestLock, exitLock, programmaticExitRef } =
    usePointerLock({
      onLockExit: () => {
        // Escape or focus loss while flying → pause
        const currentPhase = useGameStore.getState().phase
        if (currentPhase === 'flying') {
          setPhase('paused')
        }
      },
    })

  // Exit pointer lock on non-flying phases (landed, crashed, menu)
  useEffect(() => {
    if (phase !== 'flying' && phase !== 'paused' && isLocked) {
      programmaticExitRef.current = true
      exitLock()
    }
  }, [phase, isLocked, exitLock, programmaticExitRef])

  const enterImmersive = useCallback(() => {
    if (wrapperRef.current && isSupported) {
      requestLock(wrapperRef.current)
    }
  }, [isSupported, requestLock])

  const handleResume = useCallback(() => {
    enterImmersive()
  }, [enterImmersive])

  const showOverlay = phase === 'flying' && !isLocked && isSupported

  return (
    <div ref={wrapperRef} className="w-full h-screen relative">
      <Canvas
        camera={{ fov: 60, near: 1, far: 10000 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        dpr={[1, 1.5]}
        flat
      >
        <Suspense fallback={null}>
          <Sky timeOfDay={timeOfDay} />
          <Terrain timeOfDay={timeOfDay} />
          <WaterPlane timeOfDay={timeOfDay} />
          <Runway timeOfDay={timeOfDay} />
          <Aircraft />
          <CameraController />
          <PhysicsEngine />
        </Suspense>
      </Canvas>

      <FlightHUD />
      <ATCPanel />
      <PauseMenu onResume={handleResume} />
      <LandingCard />
      <KeyboardControls isImmersive={isLocked} />
      <SoundEngine />
      {showOverlay && <ImmersiveOverlay onClick={enterImmersive} />}
    </div>
  )
}
