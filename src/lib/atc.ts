import { FlightState, Scenario, RUNWAY } from '@/types/game'

const ATC_SYSTEM_PROMPT = `You are a professional Air Traffic Controller (callsign: "Mayday Approach") communicating with an aircraft (callsign: "November-One-Two-Three-Four-Alpha" or "N1234A").

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

Current scenario context will be provided with each message. Use it to give relevant, contextual ATC instructions.`

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

function buildMessages(
  conversationHistory: { role: string; text: string }[],
  currentContent: string
) {
  const messages = [
    {
      role: 'user' as const,
      parts: [{ text: ATC_SYSTEM_PROMPT }],
    },
    {
      role: 'model' as const,
      parts: [{ text: 'Roger, Mayday Approach is online and monitoring all frequencies.' }],
    },
  ]

  for (const msg of conversationHistory.slice(-10)) {
    messages.push({
      role: msg.role === 'pilot' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.text }],
    })
  }

  messages.push({
    role: 'user' as const,
    parts: [{ text: currentContent }],
  })

  return messages
}

async function callGemini(messages: { role: string; parts: { text: string }[] }[], apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    }
  )

  const data = await response.json()
  if (!response.ok) {
    console.error('[ATC] Gemini API error:', response.status, data.error?.message || JSON.stringify(data))
  }
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    'Mayday Approach, say again, transmission garbled.'
  )
}

/** Initial radar contact — Gemini generates the first callout based on scenario */
export async function requestInitialContact(
  flightContext: string,
  scenario: Scenario | null,
  apiKey: string
): Promise<string> {
  const prompt = `${flightContext}

You are making INITIAL RADAR CONTACT with this aircraft. This is the first transmission of the flight.
Greet the aircraft, confirm radar contact, and give initial approach instructions appropriate for the scenario.
${scenario?.engineFailure ? 'The aircraft has declared an emergency due to engine failure. Acknowledge the emergency and give priority vectors.' : ''}
${scenario?.timeOfDay === 'night' ? 'It is nighttime. Mention visibility conditions if relevant.' : ''}
${scenario?.windSpeed && scenario.windSpeed > 10 ? `There are significant winds. Advise the pilot about wind conditions.` : ''}
Be concise — 2-3 sentences max.`

  const messages = buildMessages([], prompt)

  try {
    return await callGemini(messages, apiKey)
  } catch {
    return 'N1234A, Mayday Approach, radar contact. Standby for approach instructions.'
  }
}

/** Pilot-initiated communication */
export async function sendToATC(
  pilotMessage: string,
  flightContext: string,
  conversationHistory: { role: string; text: string }[],
  apiKey: string
): Promise<string> {
  const content = `${flightContext}\n\nPilot transmission: "${pilotMessage}"`
  const messages = buildMessages(conversationHistory, content)

  try {
    return await callGemini(messages, apiKey)
  } catch {
    return 'N1234A, Mayday Approach experiencing technical difficulties. Standby.'
  }
}

/** Proactive ATC callout — ATC monitors flight and gives instructions unprompted */
export async function requestProactiveCallout(
  flightContext: string,
  conversationHistory: { role: string; text: string }[],
  apiKey: string
): Promise<string | null> {
  const content = `${flightContext}

[ATC MONITORING] You are monitoring this aircraft's flight. Based on the current flight data, decide if you need to issue any instructions or advisories. Consider:
- Is the aircraft on a reasonable approach path? (should be descending, heading ~360 towards runway)
- Is the speed appropriate? (ideal approach: 130-140 kts)
- Is the aircraft too high or too low for its distance?
- Does the pilot need to lower gear or extend flaps?
- Is the aircraft close enough for landing clearance? (within ~2nm and aligned)
- Any safety concerns?

If the flight is progressing normally and you have nothing important to add, respond with exactly "MONITORING" and nothing else.
If you DO need to issue an instruction or advisory, give a brief ATC transmission (1-2 sentences).`

  const messages = buildMessages(conversationHistory, content)

  try {
    const response = await callGemini(messages, apiKey)
    if (response.trim() === 'MONITORING' || response.trim().startsWith('MONITORING')) {
      return null // No callout needed
    }
    return response
  } catch {
    return null
  }
}
