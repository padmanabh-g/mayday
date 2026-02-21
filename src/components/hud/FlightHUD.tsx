'use client'

import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'

// Throttled flight data - only re-render HUD at 10fps instead of every frame
function useThrottledFlight() {
  const [data, setData] = useState(() => {
    const f = useGameStore.getState().flight
    return {
      speedKts: Math.round(f.speed * 1.944),
      altFt: Math.round(f.altitude * 3.281),
      heading: f.heading,
      vsFpm: Math.round(f.verticalSpeed * 196.85),
      throttle: f.throttle,
      pitch: f.pitch,
      roll: f.roll,
      gearDown: f.gearDown,
      flaps: f.flaps,
      braking: f.braking,
      speed: f.speed,
      onGround: f.onGround,
    }
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const f = useGameStore.getState().flight
      setData({
        speedKts: Math.round(f.speed * 1.944),
        altFt: Math.round(f.altitude * 3.281),
        heading: f.heading,
        vsFpm: Math.round(f.verticalSpeed * 196.85),
        throttle: f.throttle,
        pitch: f.pitch,
        roll: f.roll,
        gearDown: f.gearDown,
        flaps: f.flaps,
        braking: f.braking,
        speed: f.speed,
        onGround: f.onGround,
      })
    }, 100) // 10 fps
    return () => clearInterval(interval)
  }, [])

  return data
}

function Indicator({
  label,
  value,
  unit,
  warning,
}: {
  label: string
  value: string | number
  unit?: string
  warning?: boolean
}) {
  return (
    <div className={`flex flex-col items-center ${warning ? 'text-red-400' : 'text-green-400'}`}>
      <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
      <span className="text-lg font-mono font-bold tabular-nums">
        {value}
        {unit && <span className="text-xs ml-0.5 opacity-70">{unit}</span>}
      </span>
    </div>
  )
}

function ThrottleBar({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider opacity-60 text-green-400">THR</span>
      <div className="w-3 h-20 bg-black/40 border border-green-500/30 rounded-sm relative overflow-hidden">
        <div
          className="absolute bottom-0 w-full bg-green-500"
          style={{ height: `${value * 100}%` }}
        />
      </div>
      <span className="text-xs font-mono text-green-400">{Math.round(value * 100)}%</span>
    </div>
  )
}

function AttitudeIndicator({ pitch, roll }: { pitch: number; roll: number }) {
  const pitchDeg = (pitch * 180) / Math.PI
  const rollDeg = (roll * 180) / Math.PI

  return (
    <div className="relative w-24 h-24 rounded-full border-2 border-green-500/40 bg-black/40 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rollDeg}deg) translateY(${pitchDeg * 0.8}px)`,
        }}
      >
        <div className="absolute inset-0 top-0 bottom-1/2 bg-blue-900/60" />
        <div className="absolute inset-0 top-1/2 bg-amber-900/60" />
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-green-400 -translate-y-[0.5px]" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-[2px] bg-yellow-400" />
        <div className="absolute w-[2px] h-2 bg-yellow-400" />
      </div>
    </div>
  )
}

export default function FlightHUD() {
  const phase = useGameStore((s) => s.phase)
  const engineFailure = useGameStore((s) => s.scenario?.engineFailure)
  const data = useThrottledFlight()

  if (phase !== 'flying') return null

  // Aerodynamic stall at ~50 m/s; warn at 55 m/s (~107 kts) for advance notice
  const isStall = data.speed < 55 && !data.onGround
  const isOverspeed = data.speed > 110

  const getCardinal = (h: number) => {
    if (h >= 337.5 || h < 22.5) return 'N'
    if (h < 67.5) return 'NE'
    if (h < 112.5) return 'E'
    if (h < 157.5) return 'SE'
    if (h < 202.5) return 'S'
    if (h < 247.5) return 'SW'
    if (h < 292.5) return 'W'
    return 'NW'
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Top bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-start gap-6 bg-black/50 backdrop-blur-sm rounded-lg px-6 py-3 border border-green-500/20">
        <Indicator label="IAS" value={data.speedKts} unit="KTS" warning={isStall || isOverspeed} />
        <Indicator label="ALT" value={data.altFt.toLocaleString()} unit="FT" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider opacity-60 text-green-400">HDG</span>
          <span className="text-lg font-mono font-bold text-green-400">
            {Math.round(data.heading).toString().padStart(3, '0')}° {getCardinal(data.heading)}
          </span>
        </div>
        <Indicator label="VS" value={data.vsFpm > 0 ? `+${data.vsFpm}` : data.vsFpm} unit="FPM" warning={data.vsFpm < -800} />
      </div>

      {/* Left panel */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex gap-3 items-center bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-green-500/20">
        <AttitudeIndicator pitch={data.pitch} roll={data.roll} />
        <ThrottleBar value={data.throttle} />
      </div>

      {/* Right panel */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-green-500/20 flex flex-col gap-2 min-w-[100px]">
        <StatusItem label="GEAR" value={data.gearDown ? 'DOWN' : 'UP'} active={data.gearDown} />
        <StatusItem label="FLAPS" value={`${data.flaps}/3`} active={data.flaps > 0} />
        <StatusItem label="BRK" value={data.braking ? 'ON' : 'OFF'} active={data.braking} />
        {engineFailure && <StatusItem label="ENG" value="FAIL" active warning />}
      </div>

      {/* Stall warning */}
      {isStall && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 animate-pulse">
          <div className="bg-red-600/80 text-white font-bold text-2xl px-6 py-2 rounded border-2 border-red-400">
            STALL WARNING
          </div>
        </div>
      )}

      {isOverspeed && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 animate-pulse">
          <div className="bg-amber-600/80 text-white font-bold text-xl px-6 py-2 rounded border-2 border-amber-400">
            OVERSPEED
          </div>
        </div>
      )}

      {/* Controls map */}
      <div className="absolute bottom-3 left-3 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/5">
        <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-[2px] text-[9px]">
          <kbd className="text-cyan-400/70 font-mono text-right">W/S</kbd>
          <span className="text-white/30">Nose Up/Down</span>
          <kbd className="text-cyan-400/70 font-mono text-right">A/D</kbd>
          <span className="text-white/30">Roll</span>
          <kbd className="text-cyan-400/70 font-mono text-right">Q/E</kbd>
          <span className="text-white/30">Yaw</span>
          <kbd className="text-cyan-400/70 font-mono text-right">Shift/Ctrl</kbd>
          <span className="text-white/30">Throttle</span>
          <kbd className="text-cyan-400/70 font-mono text-right">G</kbd>
          <span className="text-white/30">Gear</span>
          <kbd className="text-cyan-400/70 font-mono text-right">B</kbd>
          <span className="text-white/30">Brake</span>
          <kbd className="text-cyan-400/70 font-mono text-right">F/[ ]</kbd>
          <span className="text-white/30">Flaps</span>
          <kbd className="text-cyan-400/70 font-mono text-right">V</kbd>
          <span className="text-white/30">Camera</span>
          <kbd className="text-cyan-400/70 font-mono text-right">T</kbd>
          <span className="text-white/30">Radio PTT</span>
          <kbd className="text-cyan-400/70 font-mono text-right">Esc</kbd>
          <span className="text-white/30">Exit / Pause</span>
        </div>
      </div>
    </div>
  )
}

function StatusItem({
  label,
  value,
  active,
  warning,
}: {
  label: string
  value: string
  active: boolean
  warning?: boolean
}) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-[10px] uppercase tracking-wider opacity-60 text-green-400">{label}</span>
      <span className={`text-xs font-mono font-bold ${warning ? 'text-red-400' : active ? 'text-green-400' : 'text-gray-500'}`}>
        {value}
      </span>
    </div>
  )
}
