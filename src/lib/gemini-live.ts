import { GoogleGenAI, Modality, type Session } from '@google/genai'
import { FlightState, Scenario } from '@/types/game'
import { ATC_SYSTEM_PROMPT, buildATCContext } from './atc'
import { AudioCapture } from './audio-capture'
import { AudioPlayback } from './audio-playback'

export type SessionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface GeminiLiveCallbacks {
  onStateChange: (state: SessionState) => void
  onAtcAudioStart: () => void
  onAtcAudioEnd: () => void
  onAtcTranscript: (text: string, partial: boolean) => void
  onPilotTranscript: (text: string, partial: boolean) => void
  onError: (msg: string) => void
}

const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'
const CONTEXT_INTERVAL = 10_000
const MAX_RETRIES = 3
const BASE_RETRY_DELAY = 2000

export class GeminiLiveSession {
  private session: Session | null = null
  private audioCapture: AudioCapture
  private audioPlayback: AudioPlayback
  private callbacks: GeminiLiveCallbacks
  private contextTimer: ReturnType<typeof setInterval> | null = null
  private state: SessionState = 'disconnected'
  private retryCount = 0
  private transmitting = false
  private atcSpeaking = false
  private destroyed = false

  // Stored for reconnection
  private apiKey = ''
  private getFlightState: (() => FlightState) | null = null
  private scenario: Scenario | null = null
  private accumulatedOutputTranscript = ''
  private accumulatedInputTranscript = ''

  constructor(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks
    this.audioCapture = new AudioCapture()
    this.audioPlayback = new AudioPlayback()
  }

  async connectWithContext(
    apiKey: string,
    scenario: Scenario,
    getFlightState: () => FlightState,
  ): Promise<void> {
    this.apiKey = apiKey
    this.scenario = scenario
    this.getFlightState = getFlightState
    this.retryCount = 0
    await this.connect()
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return
    this.setState('connecting')

    const scenarioContext = this.getFlightState && this.scenario
      ? buildATCContext(this.getFlightState(), this.scenario)
      : ''

    const systemPrompt = `${ATC_SYSTEM_PROMPT}

${this.scenario ? `Scenario: ${this.scenario.name}\n${this.scenario.description}` : ''}
${this.scenario?.engineFailure ? 'The aircraft has declared an EMERGENCY due to engine failure. Acknowledge the emergency and give priority handling.' : ''}
${this.scenario?.timeOfDay === 'night' ? 'It is nighttime. Mention visibility conditions as appropriate.' : ''}
${this.scenario?.windSpeed && this.scenario.windSpeed > 10 ? 'There are significant winds. Advise the pilot about wind conditions.' : ''}

Current flight data:
${scenarioContext}`

    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey })

      this.session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          systemInstruction: systemPrompt,
          realtimeInputConfig: {
            automaticActivityDetection: { disabled: true },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            this.setState('connected')
            this.retryCount = 0
            this.startContextInjection()
          },
          onmessage: (msg: ServerMessage) => this.handleMessage(msg),
          onerror: (e: { message?: string }) => {
            console.error('[GeminiLive] error:', e)
            this.callbacks.onError(e?.message || 'Connection error')
          },
          onclose: (e: { code?: number; reason?: string }) => {
            console.log('[GeminiLive] closed:', e?.reason || e?.code)
            this.handleClose()
          },
        },
      })
    } catch (err) {
      console.error('[GeminiLive] connect failed:', err)
      this.callbacks.onError(err instanceof Error ? err.message : 'Failed to connect')
      this.setState('disconnected')
      this.attemptReconnect()
    }
  }

  private handleMessage(msg: ServerMessage): void {
    if (this.destroyed) return

    // Audio data from model
    const parts = msg.serverContent?.modelTurn?.parts
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!this.atcSpeaking) {
            this.atcSpeaking = true
            this.callbacks.onAtcAudioStart()
          }
          this.audioPlayback.enqueue(part.inlineData.data)
        }
      }
    }

    // Output transcription (ATC's words)
    const outputText = msg.serverContent?.outputTranscription?.text
    if (outputText) {
      this.accumulatedOutputTranscript += outputText
      this.callbacks.onAtcTranscript(this.accumulatedOutputTranscript, true)
    }

    // Input transcription (pilot's words)
    const inputText = msg.serverContent?.inputTranscription?.text
    if (inputText) {
      this.accumulatedInputTranscript += inputText
      this.callbacks.onPilotTranscript(this.accumulatedInputTranscript, true)
    }

    // Turn complete
    if (msg.serverContent?.turnComplete) {
      if (this.atcSpeaking) {
        this.atcSpeaking = false
        this.callbacks.onAtcAudioEnd()
      }
      if (this.accumulatedOutputTranscript) {
        this.callbacks.onAtcTranscript(this.accumulatedOutputTranscript, false)
        this.accumulatedOutputTranscript = ''
      }
      if (this.accumulatedInputTranscript) {
        this.callbacks.onPilotTranscript(this.accumulatedInputTranscript, false)
        this.accumulatedInputTranscript = ''
      }
    }

    // goAway — server is shutting down this session
    if (msg.goAway) {
      console.log('[GeminiLive] goAway received, reconnecting...')
      this.attemptReconnect()
    }
  }

  private handleClose(): void {
    this.stopContextInjection()
    if (this.state === 'connected' && !this.destroyed) {
      this.attemptReconnect()
    } else if (!this.destroyed) {
      this.setState('disconnected')
    }
  }

  private attemptReconnect(): void {
    if (this.destroyed || this.retryCount >= MAX_RETRIES) {
      this.setState('disconnected')
      if (this.retryCount >= MAX_RETRIES) {
        this.callbacks.onError('Connection lost after multiple retries')
      }
      return
    }

    this.setState('reconnecting')
    const delay = BASE_RETRY_DELAY * Math.pow(2, this.retryCount)
    this.retryCount++
    setTimeout(() => {
      if (!this.destroyed) this.connect()
    }, delay)
  }

  private startContextInjection(): void {
    this.stopContextInjection()
    this.contextTimer = setInterval(() => {
      if (!this.session || !this.getFlightState || !this.scenario) return
      if (this.transmitting) return // don't inject while pilot is talking

      const context = buildATCContext(this.getFlightState(), this.scenario)
      try {
        this.session.sendClientContent({
          turns: `[FLIGHT DATA UPDATE]\n${context}`,
          turnComplete: true,
        })
      } catch (err) {
        console.warn('[GeminiLive] context injection failed:', err)
      }
    }, CONTEXT_INTERVAL)
  }

  private stopContextInjection(): void {
    if (this.contextTimer) {
      clearInterval(this.contextTimer)
      this.contextTimer = null
    }
  }

  async startTransmit(): Promise<void> {
    if (!this.session || this.transmitting) return

    // Interrupt ATC audio if it's playing (barge-in)
    if (this.atcSpeaking) {
      this.audioPlayback.interrupt()
      this.atcSpeaking = false
      this.callbacks.onAtcAudioEnd()
    }

    this.transmitting = true
    this.accumulatedInputTranscript = ''

    try {
      this.session.sendRealtimeInput({ activityStart: {} })
    } catch (err) {
      console.warn('[GeminiLive] activityStart failed:', err)
    }

    try {
      await this.audioCapture.start((base64Pcm) => {
        if (!this.session || !this.transmitting) return
        try {
          this.session.sendRealtimeInput({
            audio: {
              data: base64Pcm,
              mimeType: 'audio/pcm;rate=16000',
            },
          })
        } catch {
          // session may have closed
        }
      })
    } catch (err) {
      console.error('[GeminiLive] mic start failed:', err)
      this.transmitting = false
      this.callbacks.onError('Microphone access failed')
    }
  }

  stopTransmit(): void {
    if (!this.transmitting) return
    this.transmitting = false
    this.audioCapture.stop()

    if (this.session) {
      try {
        this.session.sendRealtimeInput({ activityEnd: {} })
      } catch {
        // session may have closed
      }
    }
  }

  sendText(text: string): void {
    if (!this.session) return
    try {
      this.session.sendClientContent({
        turns: `Pilot transmission: "${text}"`,
        turnComplete: true,
      })
    } catch (err) {
      console.warn('[GeminiLive] sendText failed:', err)
    }
  }

  disconnect(): void {
    this.stopContextInjection()
    this.stopTransmit()
    if (this.session) {
      try {
        this.session.close()
      } catch {
        // already closed
      }
      this.session = null
    }
    this.audioPlayback.interrupt()
    this.setState('disconnected')
  }

  destroy(): void {
    this.destroyed = true
    this.disconnect()
    this.audioCapture.destroy()
    this.audioPlayback.destroy()
  }

  private setState(state: SessionState): void {
    this.state = state
    this.callbacks.onStateChange(state)
  }

  getState(): SessionState {
    return this.state
  }
}

/** Minimal type for the messages we receive from the Live API */
interface ServerMessage {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string }
        text?: string
      }>
    }
    turnComplete?: boolean
    outputTranscription?: { text?: string }
    inputTranscription?: { text?: string }
  }
  goAway?: { timeLeft?: string }
}
