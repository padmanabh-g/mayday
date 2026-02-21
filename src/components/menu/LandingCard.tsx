'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { audioEngine } from '@/lib/audio'

const gradeConfig = {
  Perfect: {
    color: 'text-green-400',
    glow: 'shadow-green-400/40',
    bg: 'bg-green-400/10',
    border: 'border-green-400/30',
    barColor: 'from-green-500 to-green-400',
    label: 'PERFECT',
    subtitle: 'Butter smooth!',
    icon: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  Good: {
    color: 'text-cyan-400',
    glow: 'shadow-cyan-400/40',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/30',
    barColor: 'from-cyan-500 to-cyan-400',
    label: 'GOOD',
    subtitle: 'Solid landing',
    icon: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
      </svg>
    ),
  },
  Hard: {
    color: 'text-yellow-400',
    glow: 'shadow-yellow-400/40',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    barColor: 'from-yellow-500 to-yellow-400',
    label: 'HARD',
    subtitle: 'Rough but safe',
    icon: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  Crash: {
    color: 'text-red-400',
    glow: 'shadow-red-500/50',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
    barColor: 'from-red-600 to-red-400',
    label: 'CRASHED',
    subtitle: 'Aircraft destroyed',
    icon: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
  },
}

function ScoreBar({
  label,
  score,
  weight,
  delay,
  barColor,
}: {
  label: string
  score: number
  weight: string
  delay: number
  barColor: string
}) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-right shrink-0">
        <span className="text-white/50 text-[11px]">{label}</span>
        <span className="text-white/20 text-[9px] ml-1">({weight})</span>
      </div>
      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: animated ? `${score}%` : '0%' }}
        />
      </div>
      <span className={`w-9 text-right font-mono text-sm font-bold transition-all duration-700 ${
        animated ? 'opacity-100' : 'opacity-0'
      } ${score > 80 ? 'text-green-400' : score > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
        {score}
      </span>
    </div>
  )
}

export default function LandingCard() {
  const phase = useGameStore((s) => s.phase)
  const landingScore = useGameStore((s) => s.landingScore)
  const resetGame = useGameStore((s) => s.resetGame)
  const scenario = useGameStore((s) => s.scenario)
  const startScenario = useGameStore((s) => s.startScenario)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (phase === 'landed' || phase === 'crashed') {
      const t = setTimeout(() => setVisible(true), 300)
      return () => clearTimeout(t)
    }
    setVisible(false)
  }, [phase])

  if (phase !== 'landed' && phase !== 'crashed') return null

  const handleFlyAgain = () => {
    audioEngine.play('switch')
    if (scenario) startScenario(scenario.id)
  }

  const handleMenu = () => {
    audioEngine.play('switch')
    resetGame()
  }

  // Crash with no score — fallback
  if (!landingScore) {
    const crashConfig = gradeConfig.Crash
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center">
        <div className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`relative transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <div className="relative">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-red-500/60" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-red-500/60" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-red-500/60" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-red-500/60" />

            <div className="bg-gray-950/95 border border-red-500/20 min-w-[420px] overflow-hidden">
              <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400/80 text-[10px] font-bold uppercase tracking-[0.3em]">
                  Flight Terminated
                </span>
              </div>

              <div className="px-8 py-8 text-center">
                <div className={`${crashConfig.color} mb-3`}>{crashConfig.icon}</div>
                <div className={`text-5xl font-black tracking-wider ${crashConfig.color} mb-2`}>
                  CRASHED
                </div>
                <p className="text-white/30 text-sm mb-8">Aircraft destroyed</p>

                <div className="flex gap-3">
                  <button
                    onClick={handleFlyAgain}
                    className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm uppercase tracking-wider rounded transition-all duration-200 hover:shadow-[0_0_25px_rgba(0,255,255,0.3)] active:scale-[0.98]"
                  >
                    Retry Mission
                  </button>
                  <button
                    onClick={handleMenu}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/50 hover:text-white font-medium text-sm uppercase tracking-wider rounded transition-all duration-200 active:scale-[0.98]"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const config = gradeConfig[landingScore.grade]
  const isCrash = landingScore.grade === 'Crash'
  const accentBorder = isCrash ? 'border-red-500/60' : 'border-cyan-400/60'
  const headerBg = isCrash ? 'bg-red-500/10 border-red-500/20' : 'bg-cyan-500/10 border-cyan-500/20'
  const headerDot = isCrash ? 'bg-red-500' : 'bg-green-400'
  const headerText = isCrash ? 'text-red-400/80' : 'text-cyan-400/80'

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`} />

      {/* Scan lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,255,0.15) 1px, transparent 3px)',
        }}
      />

      <div className={`relative transition-all duration-700 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'}`}>
        <div className="relative">
          {/* Corner accents */}
          <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 ${accentBorder}`} />
          <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 ${accentBorder}`} />
          <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 ${accentBorder}`} />
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 ${accentBorder}`} />

          <div className="bg-gray-950/95 border border-white/10 min-w-[460px] max-w-[520px] overflow-hidden">
            {/* Header bar */}
            <div className={`${headerBg} border-b px-6 py-2.5 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${headerDot} animate-pulse`} />
                <span className={`${headerText} text-[10px] font-bold uppercase tracking-[0.3em]`}>
                  {isCrash ? 'Flight Terminated' : 'Flight Complete'}
                </span>
              </div>
              <span className="text-white/20 text-[10px] font-mono">
                {scenario?.name || 'Unknown'}
              </span>
            </div>

            {/* Grade + icon */}
            <div className="px-8 pt-6 pb-4 text-center">
              <div className={`${config.color} mb-2 flex justify-center`}>{config.icon}</div>
              <div className={`text-4xl font-black tracking-wider ${config.color}`}>
                {config.label}
              </div>
              <p className="text-white/30 text-xs mt-1">{config.subtitle}</p>
            </div>

            {/* Score display */}
            <div className="mx-8 mb-5">
              <div className={`text-center p-4 rounded border ${config.bg} ${config.border} relative overflow-hidden`}>
                {/* Subtle glow behind score */}
                <div className={`absolute inset-0 blur-2xl opacity-20 ${config.bg}`} />
                <span className="relative text-white/40 text-[10px] uppercase tracking-[0.2em] block mb-1">
                  Total Score
                </span>
                <div className={`relative text-5xl font-black font-mono ${config.color} tracking-tight`}>
                  {landingScore.totalScore}
                  <span className="text-lg text-white/20 font-normal ml-1">/100</span>
                </div>
              </div>
            </div>

            {/* Individual score bars */}
            <div className="px-8 pb-5 space-y-2.5">
              <ScoreBar label="Vertical Speed" score={landingScore.verticalSpeedScore} weight="30%" delay={400} barColor={config.barColor} />
              <ScoreBar label="Centerline" score={landingScore.centerlineScore} weight="25%" delay={600} barColor={config.barColor} />
              <ScoreBar label="Approach Speed" score={landingScore.approachSpeedScore} weight="25%" delay={800} barColor={config.barColor} />
              <ScoreBar label="Glideslope" score={landingScore.approachAngleScore} weight="20%" delay={1000} barColor={config.barColor} />
            </div>

            {/* Divider */}
            <div className="mx-8 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Action buttons */}
            <div className="px-8 py-5 flex gap-3">
              <button
                onClick={handleFlyAgain}
                className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm uppercase tracking-wider rounded transition-all duration-200 hover:shadow-[0_0_25px_rgba(0,255,255,0.3)] active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry Mission
                </span>
              </button>
              <button
                onClick={handleMenu}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/50 hover:text-white font-medium text-sm uppercase tracking-wider rounded transition-all duration-200 active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Main Menu
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
