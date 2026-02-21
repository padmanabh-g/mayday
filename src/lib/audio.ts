type SoundName =
  | 'engine-loop'
  | 'wind-loop'
  | 'gear-down'
  | 'gear-up'
  | 'flaps'
  | 'stall-warning'
  | 'overspeed'
  | 'touchdown'
  | 'crash'
  | 'radio-click'
  | 'switch'
  | 'menu-music'

interface ManagedAudio {
  audio: HTMLAudioElement
  loop: boolean
  baseVolume: number
}

const MANIFEST: { name: SoundName; loop: boolean; baseVolume: number }[] = [
  { name: 'engine-loop', loop: true, baseVolume: 0.3 },
  { name: 'wind-loop', loop: true, baseVolume: 0.15 },
  { name: 'gear-down', loop: false, baseVolume: 0.6 },
  { name: 'gear-up', loop: false, baseVolume: 0.6 },
  { name: 'flaps', loop: false, baseVolume: 0.5 },
  { name: 'stall-warning', loop: true, baseVolume: 0.7 },
  { name: 'overspeed', loop: true, baseVolume: 0.5 },
  { name: 'touchdown', loop: false, baseVolume: 0.8 },
  { name: 'crash', loop: false, baseVolume: 0.9 },
  { name: 'radio-click', loop: false, baseVolume: 0.4 },
  { name: 'switch', loop: false, baseVolume: 0.3 },
  { name: 'menu-music', loop: true, baseVolume: 0.25 },
]

class AudioEngine {
  private sounds: Map<SoundName, ManagedAudio> = new Map()
  private initialized = false
  private muted = false
  private initPromise: Promise<void> | null = null

  /**
   * Initialize audio engine. Safe to call multiple times.
   * Must be called from a user gesture context (click/keydown) on first call
   * to satisfy browser autoplay policies.
   */
  async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInit()
    return this.initPromise
  }

  private async _doInit(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    // Preload all sounds
    for (const { name, loop, baseVolume } of MANIFEST) {
      const audio = new Audio(`/sfx/${name}.mp3`)
      audio.loop = loop
      audio.volume = 0
      audio.preload = 'auto'
      this.sounds.set(name, { audio, loop, baseVolume })
    }

    // Wait for all audio elements to be loadable
    await Promise.allSettled(
      Array.from(this.sounds.values()).map(
        (s) =>
          new Promise<void>((resolve) => {
            if (s.audio.readyState >= 2) {
              resolve()
            } else {
              s.audio.addEventListener('canplay', () => resolve(), { once: true })
              s.audio.addEventListener('error', () => resolve(), { once: true })
              // Timeout fallback — don't block init forever
              setTimeout(resolve, 3000)
            }
          })
      )
    )
  }

  private ensureInit() {
    if (!this.initialized && !this.initPromise) {
      // Lazy init — will work if called from a user gesture
      this.init()
    }
  }

  play(name: SoundName, volume?: number) {
    if (this.muted) return
    this.ensureInit()
    const sound = this.sounds.get(name)
    if (!sound) return

    const vol = volume ?? sound.baseVolume
    if (sound.loop) {
      sound.audio.volume = vol
      if (sound.audio.paused) {
        sound.audio.play().catch(() => {})
      }
    } else {
      // For one-shots, clone and play to allow overlapping
      const clone = sound.audio.cloneNode() as HTMLAudioElement
      clone.volume = vol
      clone.play().catch(() => {})
    }
  }

  stop(name: SoundName) {
    const sound = this.sounds.get(name)
    if (!sound) return
    sound.audio.pause()
    sound.audio.currentTime = 0
  }

  setVolume(name: SoundName, volume: number) {
    const sound = this.sounds.get(name)
    if (!sound) return
    sound.audio.volume = Math.max(0, Math.min(1, volume))
  }

  fadeLoop(name: SoundName, targetVolume: number) {
    this.ensureInit()
    const sound = this.sounds.get(name)
    if (!sound || !sound.loop) return

    const clamped = Math.max(0, Math.min(1, targetVolume))

    if (clamped > 0.01) {
      sound.audio.volume = clamped
      if (sound.audio.paused) {
        sound.audio.play().catch(() => {})
      }
    } else {
      sound.audio.volume = 0
      if (!sound.audio.paused) {
        sound.audio.pause()
        sound.audio.currentTime = 0
      }
    }
  }

  stopAll() {
    for (const [, sound] of this.sounds) {
      sound.audio.pause()
      sound.audio.currentTime = 0
      sound.audio.volume = 0
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (muted) this.stopAll()
  }
}

// Singleton
export const audioEngine = new AudioEngine()
