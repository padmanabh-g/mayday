'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { audioEngine } from '@/lib/audio'
import { GeminiLiveSession, type SessionState } from '@/lib/gemini-live'

const ENV_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
const API_KEY_STORAGE_KEY = 'mayday-gemini-key'

export default function ATCPanel() {
  const phase = useGameStore((s) => s.phase)
  const scenario = useGameStore((s) => s.scenario)
  const atcMessages = useGameStore((s) => s.atcMessages)
  const atcListening = useGameStore((s) => s.atcListening)
  const atcConnected = useGameStore((s) => s.atcConnected)
  const addATCMessage = useGameStore((s) => s.addATCMessage)
  const updateLastATCMessage = useGameStore((s) => s.updateLastATCMessage)
  const setATCListening = useGameStore((s) => s.setATCListening)
  const setATCConnected = useGameStore((s) => s.setATCConnected)

  const [apiKey, setApiKey] = useState('')
  const [textInput, setTextInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [sessionState, setSessionState] = useState<SessionState>('disconnected')

  const scrollRef = useRef<HTMLDivElement>(null)
  const liveSessionRef = useRef<GeminiLiveSession | null>(null)
  const pttKeyHeld = useRef(false)

  // --- Init: API key ---
  useEffect(() => {
    if (ENV_API_KEY) {
      setApiKey(ENV_API_KEY)
    } else {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
      if (stored) setApiKey(stored)
    }
  }, [])

  // --- Auto-scroll messages ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [atcMessages])

  // --- Create / destroy live session on flight start/end ---
  useEffect(() => {
    if (phase === 'flying' && apiKey && scenario) {
      const session = new GeminiLiveSession({
        onStateChange: (state) => {
          setSessionState(state)
          setATCConnected(state === 'connected')
        },
        onAtcAudioStart: () => {
          audioEngine.play('radio-click')
        },
        onAtcAudioEnd: () => {
          // noop — turn complete handled by transcription
        },
        onAtcTranscript: (text, partial) => {
          updateLastATCMessage('atc', text, partial)
        },
        onPilotTranscript: (text, partial) => {
          updateLastATCMessage('pilot', text, partial)
        },
        onError: (msg) => {
          console.error('[ATCPanel] error:', msg)
        },
      })

      liveSessionRef.current = session
      session.connectWithContext(apiKey, scenario, () => useGameStore.getState().flight)

      return () => {
        session.destroy()
        liveSessionRef.current = null
        setATCConnected(false)
        setSessionState('disconnected')
      }
    }
  }, [phase, apiKey, scenario, setATCConnected, updateLastATCMessage])

  // --- PTT: keyboard (hold T) ---
  useEffect(() => {
    if (phase !== 'flying') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key.toLowerCase() === 't' && !pttKeyHeld.current && !e.repeat) {
        e.preventDefault()
        pttKeyHeld.current = true
        startTransmit()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't' && pttKeyHeld.current) {
        e.preventDefault()
        pttKeyHeld.current = false
        stopTransmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [phase])

  const startTransmit = useCallback(() => {
    const session = liveSessionRef.current
    if (!session) return
    setATCListening(true)
    audioEngine.play('radio-click')
    session.startTransmit()
  }, [setATCListening])

  const stopTransmit = useCallback(() => {
    const session = liveSessionRef.current
    if (!session) return
    setATCListening(false)
    session.stopTransmit()
  }, [setATCListening])

  // --- Text submit ---
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim() || !liveSessionRef.current) return
    const text = textInput.trim()
    audioEngine.play('radio-click')
    addATCMessage({ role: 'pilot', text, timestamp: Date.now() })
    liveSessionRef.current.sendText(text)
    setTextInput('')
  }

  const saveApiKey = (key: string) => {
    setApiKey(key)
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
  }

  if (phase !== 'flying') return null

  const statusLabel =
    sessionState === 'connected'
      ? 'LIVE'
      : sessionState === 'connecting'
        ? 'Connecting...'
        : sessionState === 'reconnecting'
          ? 'Reconnecting...'
          : atcListening
            ? 'Transmitting...'
            : 'Disconnected'

  return (
    <div className="absolute bottom-4 right-4 z-40 pointer-events-auto">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-8 right-0 text-[10px] text-white/40 hover:text-white/70 transition-colors"
      >
        {isExpanded ? 'Hide ATC' : 'Show ATC'}
      </button>

      {isExpanded && (
        <div className="w-80 bg-gray-950/90 backdrop-blur-md border border-cyan-500/20 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  atcConnected
                    ? 'bg-green-400 animate-pulse'
                    : sessionState === 'connecting' || sessionState === 'reconnecting'
                      ? 'bg-yellow-400 animate-pulse'
                      : apiKey
                        ? 'bg-orange-400'
                        : 'bg-red-400'
                }`}
              />
              <span className="text-cyan-400 text-xs font-bold tracking-wider uppercase">
                Mayday Approach
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-[10px]">{statusLabel}</span>
            </div>
          </div>

          {/* API Key input (if not set) */}
          {!apiKey && (
            <div className="p-3 border-b border-white/5">
              <p className="text-white/40 text-[10px] mb-2">Enter Gemini API key for AI ATC:</p>
              <input
                type="password"
                placeholder="Gemini API Key"
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-400/50"
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') saveApiKey(e.currentTarget.value)
                }}
              />
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="h-48 overflow-y-auto p-3 space-y-2">
            {atcMessages.length === 0 && (
              <p className="text-white/20 text-xs text-center mt-8">
                {sessionState === 'connecting'
                  ? 'Establishing radar contact...'
                  : atcConnected
                    ? 'Waiting for ATC...'
                    : apiKey
                      ? 'Connecting to Mayday Approach...'
                      : 'Configure API key to enable AI ATC'}
              </p>
            )}
            {atcMessages.map((msg, i) => (
              <div
                key={i}
                className={`text-xs ${
                  msg.role === 'pilot' ? 'text-white/70' : 'text-cyan-400'
                } ${msg.partial ? 'opacity-60' : ''}`}
              >
                <span className="font-bold text-[10px] uppercase tracking-wider opacity-60">
                  {msg.role === 'pilot' ? 'PILOT' : 'ATC'}:{' '}
                </span>
                {msg.text}
                {msg.partial && <span className="animate-pulse">|</span>}
              </div>
            ))}
          </div>

          {/* PTT / Voice indicator bar */}
          {atcListening && (
            <div className="px-3 py-1.5 bg-red-500/15 border-t border-red-500/20 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">
                  Transmitting
                </span>
              </div>
              {/* Audio level visualization */}
              <div className="flex-1 flex items-center justify-center gap-[2px]">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[3px] bg-red-400/60 rounded-full animate-pulse"
                    style={{
                      height: `${4 + Math.random() * 10}px`,
                      animationDelay: `${i * 80}ms`,
                      animationDuration: `${300 + Math.random() * 400}ms`,
                    }}
                  />
                ))}
              </div>
              <span className="text-red-400/50 text-[10px]">release T to send</span>
            </div>
          )}

          {/* Input area */}
          <div className="p-2 border-t border-white/5 flex gap-2">
            {/* PTT Button */}
            <button
              onMouseDown={() => startTransmit()}
              onMouseUp={() => stopTransmit()}
              onMouseLeave={() => {
                if (atcListening) stopTransmit()
              }}
              disabled={!atcConnected}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all shrink-0 ${
                atcListening
                  ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : !atcConnected
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
              }`}
              title={atcConnected ? 'Hold to talk (or press T)' : 'Waiting for connection...'}
            >
              {atcListening ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-[9px] opacity-60">T</span>
                </span>
              )}
            </button>
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={atcConnected ? 'Type or hold T to talk...' : 'Connecting...'}
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-400/50"
                onKeyDown={(e) => e.stopPropagation()}
                disabled={!atcConnected}
              />
              <button
                type="submit"
                disabled={!atcConnected}
                className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                TX
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
