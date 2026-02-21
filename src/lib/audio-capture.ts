/**
 * Manages mic → PCM 16kHz pipeline via AudioWorklet.
 * Calls onChunk with base64-encoded Int16 PCM every ~100ms.
 */
export class AudioCapture {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null

  async start(onChunk: (base64Pcm: string) => void): Promise<void> {
    this.ctx = new AudioContext({ sampleRate: 16000 })
    await this.ctx.audioWorklet.addModule('/worklets/pcm-capture-processor.js')

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
    })

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.worklet = new AudioWorkletNode(this.ctx, 'pcm-capture-processor')

    this.worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      const bytes = new Uint8Array(e.data)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      onChunk(btoa(binary))
    }

    this.source.connect(this.worklet)
    this.worklet.connect(this.ctx.destination) // required for worklet to process
  }

  stop(): void {
    if (this.worklet) {
      this.worklet.disconnect()
      this.worklet = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
  }

  destroy(): void {
    this.stop()
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}
