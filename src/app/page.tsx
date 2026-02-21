'use client'

import dynamic from 'next/dynamic'
import { useGameStore } from '@/stores/gameStore'
import MainMenu from '@/components/menu/MainMenu'

const GameScene = dynamic(() => import('@/components/game/GameScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl font-black text-white mb-2">
          <span className="text-cyan-400">MAY</span>DAY
        </div>
        <div className="text-white/30 text-sm animate-pulse">Loading flight systems...</div>
      </div>
    </div>
  ),
})

export default function Home() {
  const phase = useGameStore((s) => s.phase)

  if (phase === 'menu') {
    return <MainMenu />
  }

  return <GameScene />
}
