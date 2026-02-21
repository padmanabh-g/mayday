/**
 * Gapless PCM 24kHz audio playback via AudioContext.
 * Decodes base64 Int16 PCM chunks and schedules them back-to-back.
 */
export class AudioPlayback {
  private ctx: AudioContext
  private gain: GainNode
  private nextStartTime = 0
  private sources: AudioBufferSourceNode[] = []

  constructor() {
    this.ctx = new AudioContext({ sampleRate: 24000 })
    this.gain = this.ctx.createGain()
    this.gain.connect(this.ctx.destination)
  }

  enqueue(base64Pcm: string): void {
    // Decode base64 → Int16 → Float32
    const binary = atob(base64Pcm)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const int16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
    }

    const buffer = this.ctx.createBuffer(1, float32.length, 24000)
    buffer.getChannelData(0).set(float32)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)

    // Schedule gapless playback
    const now = this.ctx.currentTime
    if (this.nextStartTime < now) {
      this.nextStartTime = now
    }
    source.start(this.nextStartTime)
    this.nextStartTime += buffer.duration

    this.sources.push(source)
    source.onended = () => {
      const idx = this.sources.indexOf(source)
      if (idx !== -1) this.sources.splice(idx, 1)
    }
  }

  /** Stop all queued audio immediately (for barge-in). */
  interrupt(): void {
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        // already stopped
      }
    }
    this.sources = []
    this.nextStartTime = 0
  }

  get isPlaying(): boolean {
    return this.sources.length > 0
  }

  setVolume(v: number): void {
    this.gain.gain.value = Math.max(0, Math.min(1, v))
  }

  destroy(): void {
    this.interrupt()
    this.ctx.close().catch(() => {})
  }
}
