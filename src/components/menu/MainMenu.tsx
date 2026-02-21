'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { SCENARIOS, Scenario } from '@/types/game'
import { audioEngine } from '@/lib/audio'
import Image from 'next/image'

const difficultyColors = {
  Easy: 'text-green-400 border-green-500/40 bg-green-500/10',
  Medium: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  Hard: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  Expert: 'text-red-400 border-red-500/40 bg-red-500/10',
}

const scenarioImages: Record<string, string> = {
  'clear-day': '/images/scenario-clear-day.jpg',
  'night-approach': '/images/scenario-night.jpg',
  'crosswind': '/images/scenario-crosswind.jpg',
  'emergency': '/images/scenario-emergency.jpg',
}

function ScenarioCard({
  scenario,
  selected,
  onSelect,
}: {
  scenario: Scenario
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={() => {
        audioEngine.play('switch')
        onSelect()
      }}
      className={`group text-left rounded-xl border-2 overflow-hidden transition-all duration-300 ${
        selected
          ? 'border-cyan-400 shadow-lg shadow-cyan-400/25 scale-[1.02]'
          : 'border-white/10 hover:border-white/25 hover:scale-[1.01]'
      }`}
    >
      {/* Scenario Image */}
      <div className="relative h-28 overflow-hidden">
        <Image
          src={scenarioImages[scenario.id] || '/images/scenario-clear-day.jpg'}
          alt={scenario.name}
          fill
          className={`object-cover transition-all duration-500 ${
            selected ? 'scale-105 brightness-90' : 'brightness-50 group-hover:brightness-75 group-hover:scale-105'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Difficulty badge */}
        <span
          className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-sm ${
            difficultyColors[scenario.difficulty]
          }`}
        >
          {scenario.difficulty}
        </span>

        {/* Selection indicator */}
        {selected && (
          <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
        )}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-bold text-sm">{scenario.name}</h3>
        </div>
      </div>

      {/* Details */}
      <div className={`p-3 transition-colors duration-300 ${selected ? 'bg-cyan-950/40' : 'bg-white/5'}`}>
        <p className="text-white/50 text-xs mb-2 line-clamp-2">{scenario.description}</p>
        <div className="flex gap-3 text-[10px] text-white/30 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            {scenario.timeOfDay === 'night' ? (
              <>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                Night
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                Day
              </>
            )}
          </span>
          {scenario.windSpeed > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              {scenario.windSpeed}kt wind
            </span>
          )}
          {scenario.engineFailure && (
            <span className="text-red-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Engine Fail
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function MainMenu() {
  const startScenario = useGameStore((s) => s.startScenario)
  const phase = useGameStore((s) => s.phase)
  const [selectedId, setSelectedId] = useState('clear-day')
  const [showControls, setShowControls] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const musicStarted = useRef(false)

  // Fade-in animation on mount
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Start menu music on first user interaction (required by browser autoplay policy)
  useEffect(() => {
    if (phase !== 'menu') {
      musicStarted.current = false
      return
    }

    const startMusic = async () => {
      if (musicStarted.current) return
      musicStarted.current = true
      await audioEngine.init()
      audioEngine.fadeLoop('menu-music', 0.25)
    }

    // Listen for any user interaction to trigger audio
    const handler = () => {
      startMusic()
      cleanup()
    }
    const cleanup = () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('keydown', handler)
      window.removeEventListener('pointerdown', handler)
    }

    window.addEventListener('click', handler)
    window.addEventListener('keydown', handler)
    window.addEventListener('pointerdown', handler)
    return cleanup
  }, [phase])

  const handleStart = async () => {
    await audioEngine.init()
    audioEngine.play('switch')
    // Fade out menu music before starting
    audioEngine.fadeLoop('menu-music', 0)
    setTimeout(() => {
      startScenario(selectedId)
    }, 200)
  }

  const selectedScenario = SCENARIOS.find((s) => s.id === selectedId)

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.jpg"
          alt="Airport runway at dusk"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
      </div>

      {/* Animated scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.1) 2px, transparent 4px)',
        }}
      />

      {/* Content */}
      <div className={`relative z-10 min-h-screen flex flex-col items-center justify-center px-4 transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Logo */}
        <div className={`text-center mb-10 transition-all duration-1000 delay-200 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
          <div className="relative w-80 h-40 mx-auto mb-4">
            <Image
              src="/images/logo.png"
              alt="MAYDAY Flight Simulator"
              fill
              className="object-contain drop-shadow-[0_0_30px_rgba(0,255,255,0.3)]"
              priority
            />
          </div>
          <p className="text-white/40 text-xs tracking-[0.4em] uppercase">
            ATC Voice Control Simulator
          </p>
          <div className="mt-3 h-[1px] w-48 mx-auto bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        </div>

        {/* Scenario Selection */}
        <div className={`w-full max-w-2xl mb-8 transition-all duration-1000 delay-500 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-white/50 text-[10px] uppercase tracking-[0.3em] mb-4 text-center font-medium">
            Select Mission
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {SCENARIOS.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                selected={selectedId === scenario.id}
                onSelect={() => setSelectedId(scenario.id)}
              />
            ))}
          </div>
        </div>

        {/* Selected scenario brief */}
        {selectedScenario && (
          <div className={`w-full max-w-2xl mb-6 transition-all duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
            <div className="bg-white/5 border border-white/5 rounded-lg px-6 py-2.5 flex items-center justify-center gap-6 mx-auto max-w-md">
              <div className="text-center">
                <div className="text-white/25 text-[8px] uppercase tracking-wider">Alt</div>
                <div className="text-white/50 text-xs font-mono font-bold">{selectedScenario.startAltitude}m</div>
              </div>
              <div className="w-[1px] h-5 bg-white/10" />
              <div className="text-center">
                <div className="text-white/25 text-[8px] uppercase tracking-wider">Speed</div>
                <div className="text-white/50 text-xs font-mono font-bold">{Math.round(selectedScenario.startSpeed * 1.944)}kts</div>
              </div>
              <div className="w-[1px] h-5 bg-white/10" />
              <div className="text-center">
                <div className="text-white/25 text-[8px] uppercase tracking-wider">Dist</div>
                <div className="text-white/50 text-xs font-mono font-bold">{(Math.abs(selectedScenario.startPosition[2]) / 1852).toFixed(1)}nm</div>
              </div>
              {selectedScenario.windSpeed > 0 && (
                <>
                  <div className="w-[1px] h-5 bg-white/10" />
                  <div className="text-center">
                    <div className="text-white/25 text-[8px] uppercase tracking-wider">Wind</div>
                    <div className="text-white/50 text-xs font-mono font-bold">{selectedScenario.windSpeed}kt @ {selectedScenario.windDirection}&deg;</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={`flex flex-col items-center gap-5 transition-all duration-1000 delay-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <button
            onClick={handleStart}
            className="group relative overflow-hidden"
          >
            {/* Outer glow */}
            <div className="absolute -inset-1 bg-cyan-400/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Button frame with corner accents */}
            <div className="relative">
              <div className="absolute -top-[2px] -left-[2px] w-3 h-3 border-t-2 border-l-2 border-cyan-300/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -top-[2px] -right-[2px] w-3 h-3 border-t-2 border-r-2 border-cyan-300/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -bottom-[2px] -left-[2px] w-3 h-3 border-b-2 border-l-2 border-cyan-300/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -bottom-[2px] -right-[2px] w-3 h-3 border-b-2 border-r-2 border-cyan-300/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative px-20 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg uppercase tracking-wider rounded transition-all duration-300 hover:shadow-[0_0_50px_rgba(0,255,255,0.35)] active:scale-[0.97]">
                <span className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Start Flight
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              audioEngine.play('switch')
              setShowControls(!showControls)
            }}
            className="text-white/25 hover:text-white/50 text-[10px] transition-colors uppercase tracking-[0.2em] flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={showControls ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'} />
            </svg>
            {showControls ? 'Hide Controls' : 'View Controls'}
          </button>
        </div>

        {/* Controls Reference */}
        {showControls && (
          <div className="mt-5 w-full max-w-lg relative">
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t border-l border-cyan-400/30" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t border-r border-cyan-400/30" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b border-l border-cyan-400/30" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b border-r border-cyan-400/30" />

            <div className="bg-black/70 backdrop-blur-md border border-white/10 p-5">
              <h3 className="text-white/40 text-[10px] uppercase tracking-[0.3em] mb-4 text-center font-medium">
                Controls Reference
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                {[
                  ['W / \u2191', 'Nose Up'],
                  ['S / \u2193', 'Nose Down'],
                  ['A / \u2190', 'Roll Left'],
                  ['D / \u2192', 'Roll Right'],
                  ['Q', 'Yaw Left'],
                  ['E', 'Yaw Right'],
                  ['Shift', 'Throttle Up'],
                  ['Ctrl', 'Throttle Down'],
                  ['G', 'Landing Gear'],
                  ['B', 'Brake'],
                  ['F / [ / ]', 'Flaps Cycle/Dn/Up'],
                  ['V', 'Toggle Camera'],
                  ['T (hold)', 'Radio PTT'],
                  ['Esc', 'Pause'],
                ].map(([key, action]) => (
                  <div key={key} className="flex justify-between py-0.5">
                    <kbd className="text-cyan-400/70 font-mono text-[11px] bg-cyan-400/5 px-2 py-0.5 rounded border border-cyan-400/15">
                      {key}
                    </kbd>
                    <span className="text-white/35 text-xs">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className={`mt-10 text-white/15 text-[10px] tracking-wider transition-all duration-1000 delay-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
          Keyboard required &middot; Chrome/Edge recommended &middot; AI ATC powered by Gemini
        </p>
      </div>
    </div>
  )
}
