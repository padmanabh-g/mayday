import * as THREE from 'three'
import { FlightState, ControlInputs, PHYSICS, RUNWAY, Scenario } from '@/types/game'

const tempVec = new THREE.Vector3()
const tempQuat = new THREE.Quaternion()

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function safeNumber(val: number, fallback: number = 0): number {
  return Number.isFinite(val) ? val : fallback
}

export function updatePhysics(
  flight: FlightState,
  controls: ControlInputs,
  dt: number,
  scenario: Scenario | null
): Partial<FlightState> {
  // Clamp delta to prevent physics explosions
  dt = Math.min(dt, 0.05)

  const isEngineFailure = scenario?.engineFailure ?? false
  const wind = scenario
    ? {
        speed: scenario.windSpeed,
        direction: (scenario.windDirection * Math.PI) / 180,
        gusts: scenario.windGusts,
      }
    : { speed: 0, direction: 0, gusts: 0 }

  // --- Control inputs ---
  let pitchInput = 0
  let rollInput = 0
  let yawInput = 0
  let throttle = flight.throttle

  // In Three.js with Euler YXZ: +pitch = nose down, -pitch = nose up
  // pitchUp (W key) = nose up = decrease pitch
  // pitchDown (S key) = nose down = increase pitch
  if (controls.pitchUp) pitchInput -= 1
  if (controls.pitchDown) pitchInput += 1
  if (controls.rollLeft) rollInput += 1
  if (controls.rollRight) rollInput -= 1
  if (controls.yawLeft) yawInput -= 1
  if (controls.yawRight) yawInput += 1

  if (!isEngineFailure) {
    if (controls.throttleUp) throttle += 1.5 * dt
    if (controls.throttleDown) throttle -= 1.5 * dt
  }
  throttle = clamp(throttle, 0, 1)

  // --- Rotation ---
  const speedFactor = clamp(flight.speed / 40, 0.5, 1.2)
  const pitchRate = PHYSICS.PITCH_RATE * pitchInput * speedFactor * dt
  const rollRate = PHYSICS.ROLL_RATE * rollInput * speedFactor * dt
  const yawRate = PHYSICS.YAW_RATE * yawInput * speedFactor * dt

  let pitch = flight.pitch + pitchRate
  let roll = flight.roll + rollRate
  let yaw = flight.yaw + yawRate

  // Auto-level roll when no input
  if (!controls.rollLeft && !controls.rollRight) {
    roll *= 1 - 3.0 * dt
  }

  // Auto-level pitch when no input (gentler than roll — aircraft naturally wants level)
  if (!controls.pitchUp && !controls.pitchDown) {
    pitch *= 1 - 2.0 * dt
  }

  // Yaw from roll (coordinated turn)
  // Banking right (roll < 0) should turn right (yaw decreasing / clockwise)
  if (Math.abs(roll) > 0.05 && flight.speed > 15) {
    yaw += Math.sin(roll) * 0.8 * dt
  }

  pitch = clamp(pitch, -Math.PI / 3, Math.PI / 3)
  roll = clamp(roll, -Math.PI / 2.5, Math.PI / 2.5)

  // Normalize yaw
  while (yaw > Math.PI) yaw -= Math.PI * 2
  while (yaw < -Math.PI) yaw += Math.PI * 2

  // --- Build rotation quaternion ---
  tempQuat.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'))

  // Forward direction
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(tempQuat)

  // --- Forces ---
  // Thrust
  const thrustMagnitude = isEngineFailure ? 0 : throttle * PHYSICS.THRUST_ACCEL
  const thrust = forward.clone().multiplyScalar(thrustMagnitude)

  // Drag
  const speed = flight.velocity.length()
  const flapDrag = flight.flaps * PHYSICS.FLAP_DRAG_PENALTY
  const dragMagnitude = (PHYSICS.DRAG_FACTOR + flapDrag) * speed * 60
  const drag = flight.velocity.clone().normalize().multiplyScalar(-dragMagnitude)

  // Lift
  const liftFactor =
    PHYSICS.LIFT_FACTOR + flight.flaps * PHYSICS.FLAP_LIFT_BONUS
  let liftMagnitude = liftFactor * speed * 60

  // Stall
  if (speed < PHYSICS.STALL_SPEED) {
    const stallFactor = speed / PHYSICS.STALL_SPEED
    liftMagnitude *= stallFactor
  }

  // Lift direction: blend 70% world-up so banking doesn't kill vertical lift
  const aircraftUp = new THREE.Vector3(0, 1, 0).applyQuaternion(tempQuat)
  const worldUp = new THREE.Vector3(0, 1, 0)
  const liftDir = aircraftUp.lerp(worldUp, 0.7).normalize()
  const lift = liftDir.multiplyScalar(liftMagnitude)

  // Gravity
  const gravity = new THREE.Vector3(0, -PHYSICS.GRAVITY, 0)

  // Wind
  const gustOffset = Math.sin(Date.now() * 0.003) * wind.gusts
  const windForce = new THREE.Vector3(
    Math.sin(wind.direction) * (wind.speed + gustOffset) * 0.05,
    0,
    Math.cos(wind.direction) * (wind.speed + gustOffset) * 0.05
  )

  // --- Integrate ---
  const acceleration = new THREE.Vector3()
    .add(thrust)
    .add(drag)
    .add(lift)
    .add(gravity)
    .add(windForce)

  const newVelocity = flight.velocity.clone().add(acceleration.multiplyScalar(dt))

  // Ground braking
  if (flight.onGround && controls.brake) {
    const brakeForce = flight.velocity
      .clone()
      .normalize()
      .multiplyScalar(-PHYSICS.BRAKE_DECEL * dt)
    if (brakeForce.length() > newVelocity.length()) {
      newVelocity.set(0, 0, 0)
    } else {
      newVelocity.add(brakeForce)
    }
  }

  // Speed cap
  const newSpeed = newVelocity.length()
  if (newSpeed > PHYSICS.MAX_SPEED) {
    newVelocity.multiplyScalar(PHYSICS.MAX_SPEED / newSpeed)
  }

  // Position
  const newPosition = flight.position.clone().add(
    newVelocity.clone().multiplyScalar(dt)
  )

  // --- Ground collision ---
  const groundLevel = getGroundLevel(newPosition.x, newPosition.z)
  let onGround = false
  let crashed = false

  if (newPosition.y <= groundLevel) {
    newPosition.y = groundLevel
    onGround = true

    // Check landing quality
    const verticalSpeed = newVelocity.y
    const isOnRunway = isPositionOnRunway(newPosition.x, newPosition.z)

    if (verticalSpeed < -12 || !isOnRunway) {
      crashed = true
    } else {
      // On ground, kill vertical velocity
      newVelocity.y = Math.max(0, newVelocity.y)
      // Ground friction (rolling resistance)
      newVelocity.multiplyScalar(1 - 2.0 * dt)
    }

    // Level out on ground
    pitch *= 0.9
    roll *= 0.9
  }

  // Altitude floor
  if (newPosition.y < 0) newPosition.y = 0

  // --- Compute derived values ---
  const altitude = safeNumber(newPosition.y, 0)
  const heading = safeNumber(
    ((yaw * 180) / Math.PI + 360) % 360,
    0
  )
  const verticalSpeed = safeNumber(newVelocity.y, 0)
  const finalSpeed = safeNumber(newVelocity.length(), 0)

  return {
    position: newPosition,
    velocity: newVelocity,
    rotation: new THREE.Euler(pitch, yaw, roll, 'YXZ'),
    speed: finalSpeed,
    altitude,
    heading,
    verticalSpeed,
    throttle,
    pitch: safeNumber(pitch, 0),
    roll: safeNumber(roll, 0),
    yaw: safeNumber(yaw, 0),
    onGround,
    crashed,
  }
}

function getGroundLevel(x: number, z: number): number {
  // Flat zone around runway — wide enough for approach and go-around maneuvers
  const FLAT_X = 500
  const FLAT_Z_MIN = RUNWAY.THRESHOLD_Z - 500
  const FLAT_Z_MAX = RUNWAY.END_Z + 500
  const BLEND_DIST = 300 // smooth transition zone

  // Simple terrain height using noise approximation
  const scale = 0.001
  const terrainHeight =
    Math.sin(x * scale * 3) * Math.cos(z * scale * 2) * 50 +
    Math.sin(x * scale * 7 + 1) * Math.cos(z * scale * 5 + 2) * 25
  const terrain = Math.max(0, terrainHeight)

  // Compute distance outside the flat zone
  const dx = Math.max(0, Math.abs(x) - FLAT_X)
  const dzMin = Math.max(0, FLAT_Z_MIN - z)
  const dzMax = Math.max(0, z - FLAT_Z_MAX)
  const distOutside = Math.sqrt(dx * dx + dzMin * dzMin + dzMax * dzMax)

  if (distOutside <= 0) return PHYSICS.GROUND_LEVEL

  // Smooth blend from flat to terrain over BLEND_DIST
  const blend = clamp(distOutside / BLEND_DIST, 0, 1)
  return PHYSICS.GROUND_LEVEL + (terrain - PHYSICS.GROUND_LEVEL) * blend * blend
}

function isPositionOnRunway(x: number, z: number): boolean {
  return (
    Math.abs(x) < RUNWAY.WIDTH / 2 &&
    z >= RUNWAY.THRESHOLD_Z &&
    z <= RUNWAY.END_Z
  )
}

export function calculateLandingScore(
  verticalSpeedAtTouchdown: number,
  centerlineOffset: number,
  approachSpeed: number,
  approachAngle: number
): { verticalSpeedScore: number; centerlineScore: number; approachSpeedScore: number; approachAngleScore: number; totalScore: number; grade: 'Perfect' | 'Good' | 'Hard' | 'Crash' } {
  // Vertical speed scoring (fpm = m/s * 196.85)
  const vsFpm = Math.abs(verticalSpeedAtTouchdown * 196.85)
  let vsScore: number
  if (vsFpm < 100) vsScore = 100
  else if (vsFpm < 300) vsScore = 100 - ((vsFpm - 100) / 200) * 40
  else if (vsFpm < 600) vsScore = 60 - ((vsFpm - 300) / 300) * 60
  else vsScore = 0

  // Centerline scoring
  const clOffset = Math.abs(centerlineOffset)
  let clScore: number
  if (clOffset < 2) clScore = 100
  else if (clOffset < 10) clScore = 100 - ((clOffset - 2) / 8) * 40
  else if (clOffset < RUNWAY.WIDTH / 2) clScore = 60 - ((clOffset - 10) / (RUNWAY.WIDTH / 2 - 10)) * 60
  else clScore = 0

  // Approach speed scoring (ideal 67-72 m/s ~ 130-140 kts)
  const speedDelta = Math.abs(approachSpeed - 65)
  let asScore: number
  if (speedDelta < 5) asScore = 100
  else if (speedDelta < 15) asScore = 100 - ((speedDelta - 5) / 10) * 40
  else if (speedDelta < 30) asScore = 60 - ((speedDelta - 15) / 15) * 60
  else asScore = 0

  // Approach angle scoring (ideal 3°)
  const angleDelta = Math.abs(approachAngle - 3)
  let aaScore: number
  if (angleDelta < 0.5) aaScore = 100
  else if (angleDelta < 2) aaScore = 100 - ((angleDelta - 0.5) / 1.5) * 40
  else if (angleDelta < 5) aaScore = 60 - ((angleDelta - 2) / 3) * 60
  else aaScore = 0

  const totalScore =
    vsScore * 0.3 + clScore * 0.25 + asScore * 0.25 + aaScore * 0.2

  let grade: 'Perfect' | 'Good' | 'Hard' | 'Crash'
  if (vsFpm > 600) grade = 'Crash'
  else if (totalScore > 90) grade = 'Perfect'
  else if (totalScore >= 70) grade = 'Good'
  else if (totalScore >= 40) grade = 'Hard'
  else grade = 'Crash'

  return {
    verticalSpeedScore: Math.round(vsScore),
    centerlineScore: Math.round(clScore),
    approachSpeedScore: Math.round(asScore),
    approachAngleScore: Math.round(aaScore),
    totalScore: Math.round(totalScore),
    grade,
  }
}
