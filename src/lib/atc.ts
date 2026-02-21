import { FlightState, Scenario, RUNWAY } from '@/types/game'

export const ATC_SYSTEM_PROMPT = `You are a professional Air Traffic Controller (callsign: "Mayday Approach") communicating with an aircraft (callsign: "November-One-Two-Three-Four-Alpha" or "N1234A").

You speak in standard aviation radio phraseology — clipped, professional, and precise. Use standard ATC terminology:
- "Roger" (acknowledged)
- "Wilco" (will comply)
- "Affirmative" / "Negative"
- "Cleared to land" / "Cleared for approach"
- "Maintain [altitude]" / "Descend to [altitude]"
- "Turn heading [degrees]"
- "Report [position/condition]"
- "Say again" (repeat)

Communication rules:
- Keep responses SHORT (1-3 sentences max)
- Always include the aircraft callsign
- Give altitude in feet, speed in knots
- Provide vectors, altitude assignments, and landing clearance as appropriate
- React to the current flight situation (altitude, speed, position, distance to runway)
- If the pilot is too high/fast/off-course, give corrective instructions
- If the pilot declares an emergency, prioritize them and give direct vectors
- The runway is runway 36 (heading 360/north), threshold at 0m

You will receive periodic flight data updates as context. Use them to monitor the flight and issue instructions when needed. Only speak when you have something operationally useful to say — do NOT acknowledge every context update. Speak up for: vectors, altitude/speed corrections, approach clearances, gear/flaps reminders, landing clearance, safety advisories.

Begin by making initial radar contact with the aircraft when the session opens.`

export function buildATCContext(flight: FlightState, scenario: Scenario | null): string {
  const speedKts = Math.round(flight.speed * 1.944)
  const altFt = Math.round(flight.altitude * 3.281)
  const vsFpm = Math.round(flight.verticalSpeed * 196.85)
  const heading = Math.round(flight.heading)
  // Distance to runway threshold (centerline at x=0, threshold at RUNWAY.THRESHOLD_Z)
  const dzToThreshold = flight.position.z - RUNWAY.THRESHOLD_Z
  const distanceToRunway = Math.round(
    Math.sqrt(flight.position.x ** 2 + dzToThreshold ** 2)
  )
  const distanceNm = (distanceToRunway / 1852).toFixed(1)

  return `
[FLIGHT DATA]
Aircraft: N1234A
Lateral offset: ${Math.round(flight.position.x)}m (positive=right of centerline)
Distance from runway: ${distanceNm} nm (${distanceToRunway}m)
Altitude: ${altFt} ft
Speed: ${speedKts} kts
Heading: ${heading}°
Vertical Speed: ${vsFpm} fpm
Gear: ${flight.gearDown ? 'DOWN' : 'UP'}
Flaps: ${flight.flaps}/3
On Ground: ${flight.onGround}
${scenario?.engineFailure ? '*** ENGINE FAILURE - EMERGENCY ***' : ''}
Scenario: ${scenario?.name || 'Unknown'}
Time of day: ${scenario?.timeOfDay || 'day'}
Wind: ${scenario?.windSpeed || 0}kt from ${scenario?.windDirection || 0}°
${scenario?.windGusts ? `Gusts: ${scenario.windGusts}kt` : ''}
`.trim()
}
