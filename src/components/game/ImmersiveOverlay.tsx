'use client'

interface ImmersiveOverlayProps {
  onClick: () => void
}

export default function ImmersiveOverlay({ onClick }: ImmersiveOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center cursor-pointer bg-black/40 backdrop-blur-[2px]"
      onClick={onClick}
    >
      <div className="text-center select-none">
        <div className="relative">
          {/* Corner accents */}
          <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
          <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
          <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
          <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />

          <div className="bg-gray-950/90 border border-white/10 px-10 py-8">
            <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-cyan-400/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.414 1.415l.708-.708zm-7.071 7.072l.707-.708A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" />
              </svg>
            </div>

            <h3 className="text-white text-lg font-bold uppercase tracking-wider mb-2">
              Click to Enter Flight
            </h3>
            <p className="text-white/40 text-xs tracking-wide">
              Press <kbd className="text-cyan-400/70 font-mono px-1 py-0.5 bg-white/5 rounded">ESC</kbd> to pause
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
