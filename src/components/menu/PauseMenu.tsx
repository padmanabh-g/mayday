'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { audioEngine } from '@/lib/audio'

export default function PauseMenu({ onResume }: { onResume?: () => void }) {
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const resetGame = useGameStore((s) => s.resetGame)
  const flight = useGameStore((s) => s.flight)
  const scenario = useGameStore((s) => s.scenario)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (phase === 'paused') {
      const t = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(t)
    }
    setVisible(false)
  }, [phase])

  if (phase !== 'paused') return null

  const altFt = Math.round(flight.altitude * 3.281)
  const speedKts = Math.round(flight.speed * 1.944)

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay with vignette */}
      <div className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`} />

      {/* Animated scan lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,255,0.15) 1px, transparent 3px)',
        }}
      />

      {/* Content */}
      <div className={`relative transition-all duration-500 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Outer container with HUD frame */}
        <div className="relative">
          {/* Corner accents */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-cyan-400/60" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-cyan-400/60" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-cyan-400/60" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-cyan-400/60" />

          <div className="bg-gray-950/95 border border-white/10 min-w-[380px] overflow-hidden">
            {/* Header bar */}
            <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400/80 text-[10px] font-bold uppercase tracking-[0.3em]">
                  Flight Paused
                </span>
              </div>
              <span className="text-white/20 text-[10px] font-mono">ESC</span>
            </div>

            {/* Title */}
            <div className="px-6 pt-6 pb-4 text-center">
              <h2 className="text-4xl font-black tracking-wider text-white uppercase">
                Paused
              </h2>
              <div className="mt-2 h-[1px] w-24 mx-auto bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
            </div>

            {/* Flight status strip */}
            <div className="mx-6 mb-6 bg-white/5 border border-white/5 rounded px-4 py-2.5 flex items-center justify-between">
              <div className="text-center">
                <div className="text-white/25 text-[8px] uppercase tracking-wider">Alt</div>
                <div className="text-white/60 text-xs font-mono font-bold">{altFt} ft</div>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-white/25 text-[8px] uppercase tracking-wider">IAS</div>
                <div className="text-white/60 text-xs font-mono font-bold">{speedKts} kts</div>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-white/25 text-[8px] uppercase tracking-wider">HDG</div>
                <div className="text-white/60 text-xs font-mono font-bold">{Math.round(flight.heading)}&deg;</div>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-white/25 text-[8px] uppercase tracking-wider">Scenario</div>
                <div className="text-white/60 text-xs font-mono font-bold truncate max-w-[80px]">{scenario?.name || '—'}</div>
              </div>
            </div>

            {/* Buttons */}
            <div className="px-6 pb-6 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  audioEngine.play('switch')
                  onResume?.()
                  setPhase('flying')
                }}
                className="group relative w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm uppercase tracking-wider rounded transition-all duration-200 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Resume Flight
                </span>
              </button>

              <button
                onClick={() => {
                  audioEngine.play('switch')
                  resetGame()
                }}
                className="w-full py-3 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 font-medium text-sm uppercase tracking-wider rounded transition-all duration-200 active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Exit to Menu
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
