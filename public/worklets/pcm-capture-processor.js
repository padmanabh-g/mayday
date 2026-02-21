/**
 * AudioWorklet processor that captures mic audio and emits 100ms PCM16 chunks.
 * Runs in the AudioWorklet thread at 16 kHz (set by the AudioContext).
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buffer = new Float32Array(1600) // 100ms at 16kHz
    this._offset = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const channel = input[0]
    let i = 0

    while (i < channel.length) {
      const remaining = this._buffer.length - this._offset
      const toCopy = Math.min(remaining, channel.length - i)
      this._buffer.set(channel.subarray(i, i + toCopy), this._offset)
      this._offset += toCopy
      i += toCopy

      if (this._offset >= this._buffer.length) {
        // Convert float32 [-1, 1] to int16 PCM
        const pcm = new Int16Array(this._buffer.length)
        for (let j = 0; j < this._buffer.length; j++) {
          const s = Math.max(-1, Math.min(1, this._buffer[j]))
          pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer])
        this._buffer = new Float32Array(1600)
        this._offset = 0
      }
    }

    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
