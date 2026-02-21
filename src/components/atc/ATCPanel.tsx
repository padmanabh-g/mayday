'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { sendToATC, buildATCContext, requestInitialContact, requestProactiveCallout } from '@/lib/atc'
import { audioEngine } from '@/lib/audio'

const ENV_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
const API_KEY_STORAGE_KEY = 'mayday-gemini-key'
const PROACTIVE_INTERVAL = 25_000

type MicStatus = 'unknown' | 'requesting' | 'granted' | 'denied'

export default function ATCPanel() {
  const phase = useGameStore((s) => s.phase)
  const atcMessages = useGameStore((s) => s.atcMessages)
  const atcListening = useGameStore((s) => s.atcListening)
  const atcThinking = useGameStore((s) => s.atcThinking)
  const addATCMessage = useGameStore((s) => s.addATCMessage)
  const setATCListening = useGameStore((s) => s.setATCListening)
  const setATCThinking = useGameStore((s) => s.setATCThinking)

  const [apiKey, setApiKey] = useState('')
  const [textInput, setTextInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [micStatus, setMicStatus] = useState<MicStatus>('unknown')
  const [interimText, setInterimText] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const proactiveTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialContactDone = useRef(false)
  const pttKeyHeld = useRef(false)

  // --- Init: API key + voice support detection ---
  useEffect(() => {
    if (ENV_API_KEY) {
      setApiKey(ENV_API_KEY)
    } else {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
      if (stored) setApiKey(stored)
    }
    const hasVoice = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    setVoiceSupported(hasVoice)

    // Check existing mic permission without prompting
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        if (result.state === 'granted') setMicStatus('granted')
        else if (result.state === 'denied') setMicStatus('denied')
        // 'prompt' = unknown, we'll ask on first PTT
        result.addEventListener('change', () => {
          if (result.state === 'granted') setMicStatus('granted')
          else if (result.state === 'denied') setMicStatus('denied')
        })
      }).catch(() => {
        // permissions API not available, we'll try on first use
      })
    }
  }, [])

  // --- Request mic permission proactively when flight starts ---
  useEffect(() => {
    if (phase === 'flying' && voiceSupported && micStatus === 'unknown') {
      requestMicPermission()
    }
  }, [phase, voiceSupported, micStatus])

  const requestMicPermission = useCallback(async () => {
    setMicStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted — stop the stream immediately (we use SpeechRecognition, not raw audio)
      stream.getTracks().forEach((t) => t.stop())
      setMicStatus('granted')
    } catch {
      setMicStatus('denied')
    }
  }, [])

  // --- Auto-scroll messages ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [atcMessages, interimText])

  // --- TTS for ATC ---
  const speakText = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.1
    utterance.pitch = 0.9
    const voices = window.speechSynthesis.getVoices()
    const maleVoice = voices.find(
      (v) => v.name.includes('Male') || v.name.includes('Daniel') || v.name.includes('Alex')
    )
    if (maleVoice) utterance.voice = maleVoice
    window.speechSynthesis.speak(utterance)
  }, [])

  const addATCResponse = useCallback((text: string) => {
    audioEngine.play('radio-click')
    addATCMessage({ role: 'atc', text, timestamp: Date.now() })
    speakText(text)
  }, [addATCMessage, speakText])

  // --- Initial contact via Gemini ---
  useEffect(() => {
    if (phase === 'flying' && !initialContactDone.current && apiKey) {
      initialContactDone.current = true
      setATCThinking(true)

      const doInitialContact = async () => {
        await new Promise((r) => setTimeout(r, 2000))
        const currentFlight = useGameStore.getState().flight
        const currentScenario = useGameStore.getState().scenario
        if (useGameStore.getState().phase !== 'flying') return

        const context = buildATCContext(currentFlight, currentScenario)
        const greeting = await requestInitialContact(context, currentScenario, apiKey)

        if (useGameStore.getState().phase !== 'flying') return
        addATCResponse(greeting)
        setATCThinking(false)
      }
      doInitialContact()
    }
    if (phase === 'menu' || phase === 'landed' || phase === 'crashed') {
      initialContactDone.current = false
    }
  }, [phase, apiKey, addATCResponse, setATCThinking])

  // --- Proactive ATC monitoring ---
  useEffect(() => {
    if (phase === 'flying' && apiKey) {
      proactiveTimer.current = setInterval(async () => {
        const state = useGameStore.getState()
        if (state.phase !== 'flying' || state.atcThinking || state.atcListening) return

        const context = buildATCContext(state.flight, state.scenario)
        const history = state.atcMessages.map((m) => ({ role: m.role, text: m.text }))
        const callout = await requestProactiveCallout(context, history, apiKey)

        if (useGameStore.getState().phase !== 'flying') return
        if (callout) addATCResponse(callout)
      }, PROACTIVE_INTERVAL)

      return () => {
        if (proactiveTimer.current) {
          clearInterval(proactiveTimer.current)
          proactiveTimer.current = null
        }
      }
    } else {
      if (proactiveTimer.current) {
        clearInterval(proactiveTimer.current)
        proactiveTimer.current = null
      }
    }
  }, [phase, apiKey, addATCResponse])

  // --- Pilot message handler ---
  const handlePilotMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      audioEngine.play('radio-click')
      addATCMessage({ role: 'pilot', text: message, timestamp: Date.now() })
      setATCThinking(true)

      if (!apiKey) {
        addATCResponse('N1234A, unable to process. ATC system offline. Configure Gemini API key.')
        setATCThinking(false)
        return
      }

      const currentState = useGameStore.getState()
      const context = buildATCContext(currentState.flight, currentState.scenario)
      // Exclude the just-added pilot message from history — sendToATC appends it separately
      const history = currentState.atcMessages.slice(0, -1).map((m) => ({ role: m.role, text: m.text }))

      const response = await sendToATC(message, context, history, apiKey)
      addATCResponse(response)
      setATCThinking(false)
    },
    [apiKey, addATCMessage, addATCResponse, setATCThinking]
  )

  // --- Voice recognition start/stop ---
  const startListening = useCallback(() => {
    if (micStatus === 'denied') return
    if (recognitionRef.current) return // already active

    const SpeechRecognitionClass =
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ||
      window.SpeechRecognition
    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (interim) {
        setInterimText(interim)
      }

      if (finalTranscript) {
        setInterimText('')
        handlePilotMessage(finalTranscript.trim())
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are normal when user releases PTT quickly
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error)
      }
      setATCListening(false)
      setInterimText('')
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setATCListening(false)
      setInterimText('')
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setATCListening(true)
    audioEngine.play('radio-click')
  }, [micStatus, handlePilotMessage, setATCListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setATCListening(false)
    setInterimText('')
  }, [setATCListening])

  // --- Keyboard PTT: hold T to talk ---
  useEffect(() => {
    if (phase !== 'flying' || !voiceSupported || micStatus !== 'granted') return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in the text input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key.toLowerCase() === 't' && !pttKeyHeld.current && !e.repeat) {
        e.preventDefault()
        pttKeyHeld.current = true
        startListening()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't' && pttKeyHeld.current) {
        e.preventDefault()
        pttKeyHeld.current = false
        stopListening()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      // Clean up if component unmounts while listening
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [phase, voiceSupported, micStatus, startListening, stopListening])

  // --- Text submit ---
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (textInput.trim()) {
      handlePilotMessage(textInput.trim())
      setTextInput('')
    }
  }

  const saveApiKey = (key: string) => {
    setApiKey(key)
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
  }

  if (phase !== 'flying') return null

  const micReady = voiceSupported && micStatus === 'granted'
  const micDenied = micStatus === 'denied'

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
              <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-cyan-400 text-xs font-bold tracking-wider uppercase">
                Mayday Approach
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mic status indicator */}
              {micReady && (
                <div className="flex items-center gap-1" title="Microphone ready — hold T to talk">
                  <svg className="w-3 h-3 text-green-400/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {micDenied && (
                <div className="flex items-center gap-1" title="Microphone denied — use text input">
                  <svg className="w-3 h-3 text-red-400/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <span className="text-white/30 text-[10px]">
                {atcListening
                  ? 'Transmitting...'
                  : atcThinking
                    ? 'ATC thinking...'
                    : 'LIVE'}
              </span>
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

          {/* Mic permission banner */}
          {voiceSupported && micStatus === 'unknown' && (
            <button
              onClick={requestMicPermission}
              className="w-full px-3 py-2 bg-cyan-500/10 border-b border-cyan-500/10 text-cyan-400/80 text-[10px] text-left hover:bg-cyan-500/15 transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Enable microphone for voice radio
            </button>
          )}
          {micStatus === 'requesting' && (
            <div className="w-full px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/10 text-yellow-400/80 text-[10px] flex items-center gap-2 animate-pulse">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Allow microphone access in browser prompt...
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="h-48 overflow-y-auto p-3 space-y-2">
            {atcMessages.length === 0 && !interimText && (
              <p className="text-white/20 text-xs text-center mt-8">
                {atcThinking
                  ? 'Establishing radar contact...'
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
                }`}
              >
                <span className="font-bold text-[10px] uppercase tracking-wider opacity-60">
                  {msg.role === 'pilot' ? 'PILOT' : 'ATC'}:{' '}
                </span>
                {msg.text}
              </div>
            ))}

            {/* Interim speech preview */}
            {interimText && (
              <div className="text-xs text-white/40 italic">
                <span className="font-bold text-[10px] uppercase tracking-wider opacity-40">
                  PILOT:{' '}
                </span>
                {interimText}
                <span className="animate-pulse">|</span>
              </div>
            )}

            {atcThinking && atcMessages.length > 0 && (
              <div className="text-cyan-400/50 text-xs animate-pulse">ATC is responding...</div>
            )}
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
              <span className="text-red-400/50 text-[10px]">
                release T to send
              </span>
            </div>
          )}

          {/* Input area */}
          <div className="p-2 border-t border-white/5 flex gap-2">
            {/* PTT Button */}
            {voiceSupported && (
              <button
                onMouseDown={() => {
                  if (micStatus !== 'granted') {
                    requestMicPermission()
                    return
                  }
                  startListening()
                }}
                onMouseUp={stopListening}
                onMouseLeave={() => {
                  if (atcListening) stopListening()
                }}
                disabled={micDenied}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all shrink-0 ${
                  atcListening
                    ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                    : micDenied
                      ? 'bg-white/5 text-white/20 cursor-not-allowed'
                      : micStatus === 'granted'
                        ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                }`}
                title={
                  micDenied
                    ? 'Microphone access denied'
                    : micStatus === 'granted'
                      ? 'Hold to talk (or press T)'
                      : 'Click to enable microphone'
                }
              >
                {atcListening ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[9px] opacity-60">T</span>
                  </span>
                )}
              </button>
            )}
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={micReady ? 'Type or hold T to talk...' : 'Type radio message...'}
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-400/50"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <button
                type="submit"
                className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30"
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
