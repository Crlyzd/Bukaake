/**
 * Bukaake Audio Stream Receiver
 * Receives uncompressed 48kHz stereo PCM binary chunks from Rust WASAPI capture
 * and routes them into a MediaStreamAudioDestinationNode for MediaRecorder (< 150 lines)
 */

export class AudioStreamReceiver {
  constructor() {
    this.audioCtx = null;
    this.destNode = null;
    this.gainNode = null;
    this.nextPlayTime = 0;
    this.sampleRate = 48000;
    this.channels = 2;
    this.isActive = false;
  }

  /**
   * Initializes the Web Audio context and destination stream.
   * Must be called on user interaction (e.g. startRecording).
   */
  async start() {
    if (this.isActive) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass({
      sampleRate: this.sampleRate,
      latencyHint: 'interactive',
    });

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.destNode = this.audioCtx.createMediaStreamDestination();
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 1.0;
    this.gainNode.connect(this.destNode);

    this.nextPlayTime = this.audioCtx.currentTime;
    this.isActive = true;
  }

  /**
   * Returns the MediaStreamTrack containing the mixed, un-sandboxed audio.
   */
  getAudioTrack() {
    if (!this.destNode || !this.destNode.stream) return null;
    const tracks = this.destNode.stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  /**
   * Receives a raw 16-bit PCM buffer (interleaved stereo, 48000 Hz, LE)
   * and schedules it smoothly in Web Audio.
   * @param {Uint8Array|ArrayBuffer|number[]} rawBytes
   */
  feedPcmChunk(rawBytes) {
    if (!this.isActive || !this.audioCtx || !this.gainNode) return;

    const bytes = rawBytes instanceof Uint8Array
      ? rawBytes
      : new Uint8Array(rawBytes.buffer || rawBytes);

    if (bytes.byteLength < 4) return;

    const numSamples = Math.floor(bytes.byteLength / (2 * this.channels));
    if (numSamples <= 0) return;

    const audioBuffer = this.audioCtx.createBuffer(this.channels, numSamples, this.sampleRate);
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let i = 0; i < numSamples; i++) {
      const byteIdx = i * 4;
      const leftSample = view.getInt16(byteIdx, true);
      const rightSample = view.getInt16(byteIdx + 2, true);

      leftChannel[i] = leftSample / 32768.0;
      rightChannel[i] = rightSample / 32768.0;
    }

    // Micro-smooth edge samples to eliminate buffer boundary click/scratch artifacts
    const fadeLen = Math.min(16, Math.floor(numSamples / 4));
    for (let j = 0; j < fadeLen; j++) {
      const ramp = j / fadeLen;
      leftChannel[j] *= ramp;
      rightChannel[j] *= ramp;
      const endJ = numSamples - 1 - j;
      leftChannel[endJ] *= ramp;
      rightChannel[endJ] *= ramp;
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    // Schedule playback seamlessly with a small cushion to avoid buffer underruns
    const now = this.audioCtx.currentTime;
    if (this.nextPlayTime < now) {
      this.nextPlayTime = now + 0.025;
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
  }

  /**
   * Sets overall gain (e.g. for live muting or volume adjustment).
   */
  setGain(value) {
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(value, this.audioCtx.currentTime);
    }
  }

  /**
   * Cleans up audio context and releases resources.
   */
  stop() {
    this.isActive = false;
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {
        // ignore
      }
      this.audioCtx = null;
    }
    this.destNode = null;
    this.gainNode = null;
    this.nextPlayTime = 0;
  }
}
