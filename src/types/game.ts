import * as THREE from 'three'

export interface FlightState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  speed: number
  altitude: number
  heading: number
  verticalSpeed: number
  throttle: number
  pitch: number
  roll: number
  yaw: number
  gearDown: boolean
  flaps: number // 0-3 notches
  braking: boolean
  onGround: boolean
  crashed: boolean
}

export interface ControlInputs {
  pitchUp: boolean
  pitchDown: boolean
  rollLeft: boolean
  rollRight: boolean
  yawLeft: boolean
  yawRight: boolean
  throttleUp: boolean
  throttleDown: boolean
  brake: boolean
}

export interface LandingScore {
  verticalSpeedScore: number
  centerlineScore: number
  approachSpeedScore: number
  approachAngleScore: number
  totalScore: number
  grade: 'Perfect' | 'Good' | 'Hard' | 'Crash'
}

export interface ATCMessage {
  role: 'pilot' | 'atc'
  text: string
  timestamp: number
  partial?: boolean
}

export type GamePhase = 'menu' | 'flying' | 'landed' | 'crashed' | 'paused'

export type CameraMode = 'chase' | 'cockpit'

export type Scenario = {
  id: string
  name: string
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert'
  description: string
  challenge: string
  timeOfDay: 'day' | 'night'
  windSpeed: number
  windDirection: number
  windGusts: number
  startPosition: [number, number, number]
  startHeading: number
  startAltitude: number
  startSpeed: number
  engineFailure?: boolean
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'clear-day',
    name: 'Clear Day Landing',
    difficulty: 'Easy',
    description: 'Perfect weather conditions for a standard ILS approach.',
    challenge: 'Standard approach, calm winds',
    timeOfDay: 'day',
    windSpeed: 0,
    windDirection: 0,
    windGusts: 0,
    startPosition: [0, 500, -5000],
    startHeading: 0,
    startAltitude: 500,
    startSpeed: 70,
  },
  {
    id: 'night-approach',
    name: 'Night Approach',
    difficulty: 'Medium',
    description: 'Reduced visibility night approach. Rely on instruments and runway lights.',
    challenge: 'Reduced visibility, instrument reliance',
    timeOfDay: 'night',
    windSpeed: 5,
    windDirection: 30,
    windGusts: 2,
    startPosition: [0, 600, -6000],
    startHeading: 0,
    startAltitude: 600,
    startSpeed: 70,
  },
  {
    id: 'crosswind',
    name: 'Crosswind Landing',
    difficulty: 'Hard',
    description: 'Strong crosswind with gusts. Maintain crab angle and correct on final.',
    challenge: '20 kt crosswind with gusts',
    timeOfDay: 'day',
    windSpeed: 20,
    windDirection: 90,
    windGusts: 8,
    startPosition: [200, 500, -5000],
    startHeading: 0,
    startAltitude: 500,
    startSpeed: 75,
  },
  {
    id: 'emergency',
    name: 'Emergency Landing',
    difficulty: 'Expert',
    description: 'Engine failure! Glide to the runway with no power. Every decision counts.',
    challenge: 'Engine failure, glide-only approach',
    timeOfDay: 'day',
    windSpeed: 5,
    windDirection: 180,
    windGusts: 3,
    startPosition: [0, 800, -4000],
    startHeading: 0,
    startAltitude: 800,
    startSpeed: 65,
    engineFailure: true,
  },
]

// Physics constants
export const PHYSICS = {
  GRAVITY: 9.81,
  MAX_SPEED: 120,
  STALL_SPEED: 25,
  PITCH_RATE: 1.8,
  ROLL_RATE: 2.5,
  YAW_RATE: 0.8,
  THRUST_ACCEL: 20,
  DRAG_FACTOR: 0.003,
  BRAKE_DECEL: 12,
  LIFT_FACTOR: 0.0027,
  GROUND_LEVEL: 0,
  FLAP_LIFT_BONUS: 0.0008,
  FLAP_DRAG_PENALTY: 0.0005,
} as const

// Runway constants
export const RUNWAY = {
  LENGTH: 3000,
  WIDTH: 45,
  POSITION: [0, 0, 0] as [number, number, number],
  HEADING: 0, // North-South runway (runway 36)
  THRESHOLD_Z: -1500,
  END_Z: 1500,
  PAPI_ANGLE: 3, // degrees
} as const
