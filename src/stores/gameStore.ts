import { create } from 'zustand'
import * as THREE from 'three'
import {
  FlightState,
  ControlInputs,
  LandingScore,
  ATCMessage,
  GamePhase,
  CameraMode,
  Scenario,
  SCENARIOS,
} from '@/types/game'

interface GameStore {
  // Game state
  phase: GamePhase
  scenario: Scenario | null
  cameraMode: CameraMode
  elapsedTime: number

  // Flight state
  flight: FlightState
  controls: ControlInputs

  // ATC
  atcMessages: ATCMessage[]
  atcListening: boolean
  atcThinking: boolean

  // Landing
  landingScore: LandingScore | null

  // Actions
  setPhase: (phase: GamePhase) => void
  startScenario: (scenarioId: string) => void
  toggleCamera: () => void
  toggleGear: () => void
  setFlaps: (delta: number) => void
  setBraking: (braking: boolean) => void
  setControl: (key: keyof ControlInputs, value: boolean) => void
  updateFlight: (state: Partial<FlightState>) => void
  addATCMessage: (message: ATCMessage) => void
  setATCListening: (listening: boolean) => void
  setATCThinking: (thinking: boolean) => void
  setLandingScore: (score: LandingScore) => void
  resetGame: () => void
  setElapsedTime: (time: number) => void
}

const initialControls: ControlInputs = {
  pitchUp: false,
  pitchDown: false,
  rollLeft: false,
  rollRight: false,
  yawLeft: false,
  yawRight: false,
  throttleUp: false,
  throttleDown: false,
  brake: false,
}

const createInitialFlight = (scenario?: Scenario): FlightState => {
  const speed = scenario?.startSpeed ?? 70
  const headingRad = ((scenario?.startHeading ?? 0) * Math.PI) / 180
  return {
  position: new THREE.Vector3(
    ...(scenario?.startPosition ?? [0, 500, -5000])
  ),
  velocity: new THREE.Vector3(
    Math.sin(headingRad) * speed,
    0,
    Math.cos(headingRad) * speed
  ),
  rotation: new THREE.Euler(0, headingRad, 0, 'YXZ'),
  speed,
  altitude: scenario?.startAltitude ?? 500,
  heading: scenario?.startHeading ?? 0,
  verticalSpeed: 0,
  throttle: scenario?.engineFailure ? 0 : 0.6,
  pitch: 0,
  roll: 0,
  yaw: headingRad,
  gearDown: false,
  flaps: 0,
  braking: false,
  onGround: false,
  crashed: false,
}}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'menu',
  scenario: null,
  cameraMode: 'chase',
  elapsedTime: 0,

  flight: createInitialFlight(),
  controls: { ...initialControls },

  atcMessages: [],
  atcListening: false,
  atcThinking: false,

  landingScore: null,

  setPhase: (phase) => set({ phase }),

  startScenario: (scenarioId) => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)
    if (!scenario) return
    set({
      phase: 'flying',
      scenario,
      flight: createInitialFlight(scenario),
      controls: { ...initialControls },
      atcMessages: [],
      atcThinking: false,
      atcListening: false,
      landingScore: null,
      elapsedTime: 0,
      cameraMode: 'chase',
    })
  },

  toggleCamera: () =>
    set((state) => ({
      cameraMode: state.cameraMode === 'chase' ? 'cockpit' : 'chase',
    })),

  toggleGear: () =>
    set((state) => ({
      flight: { ...state.flight, gearDown: !state.flight.gearDown },
    })),

  setFlaps: (delta) =>
    set((state) => ({
      flight: {
        ...state.flight,
        flaps: Math.max(0, Math.min(3, state.flight.flaps + delta)),
      },
    })),

  setBraking: (braking) =>
    set((state) => ({
      flight: { ...state.flight, braking },
    })),

  setControl: (key, value) =>
    set((state) => ({
      controls: { ...state.controls, [key]: value },
    })),

  updateFlight: (updates) =>
    set((state) => ({
      flight: { ...state.flight, ...updates },
    })),

  addATCMessage: (message) =>
    set((state) => ({
      atcMessages: [...state.atcMessages, message],
    })),

  setATCListening: (listening) => set({ atcListening: listening }),
  setATCThinking: (thinking) => set({ atcThinking: thinking }),

  setLandingScore: (score) => set({ landingScore: score }),

  setElapsedTime: (time) => set({ elapsedTime: time }),

  resetGame: () =>
    set({
      phase: 'menu',
      scenario: null,
      flight: createInitialFlight(),
      controls: { ...initialControls },
      atcMessages: [],
      atcThinking: false,
      atcListening: false,
      landingScore: null,
      elapsedTime: 0,
      cameraMode: 'chase',
    }),
}))
