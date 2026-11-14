/**
 * Bukaake Animated Image Player
 * Streams animated GIF, WebP, APNG, and AVIF frames via WebCodecs ImageDecoder
 */

export const MAX_ANIMATED_FILE_BYTES = 30 * 1024 * 1024;
const EXT_TO_MIME = { gif: 'image/gif', webp: 'image/webp', png: 'image/png', apng: 'image/png', avif: 'image/avif' };
const SUPPORTED_MIMES = new Set(['image/gif', 'image/webp', 'image/png', 'image/avif']);

function resolveMimeType(meta = {}) {
  const rawMime = (meta.mimeType || '').toLowerCase().split(';')[0].trim();
  if (SUPPORTED_MIMES.has(rawMime)) return rawMime;
  const ext = (meta.name || meta.path || '').split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || null;
}

export class AnimatedImagePlayer {
  constructor({ onFrame, onSizeLimitExceeded } = {}) {
    this.onFrame = onFrame || null;
    this.onSizeLimitExceeded = onSizeLimitExceeded || null;
    this.sessionId = 0;
    this.decoder = null;
    this.track = null;
    this.frameCount = 0;
    this.frameIndex = 0;
    this.repetitionCount = Infinity;
    this.completedLoops = 0;
    this.currentFrame = null;
    this.nextFramePromise = null;
    this.nextFrameIndex = -1;
    this.rafId = null;
    this.playing = false;
    this.userPaused = false;
    this.animated = false;
    this.lastFrameTime = 0;
    this.currentFrameDurationMs = 100;
  }

  isAnimated() { return this.animated; }
  isPlaying() { return this.playing; }

  async load(imgSrc, meta = {}) {
    const sid = this.dispose();
    if (!('ImageDecoder' in window) || !imgSrc) return false;
    const mimeType = resolveMimeType(meta);
    if (!mimeType) return false;
    if (typeof meta.sizeBytes === 'number' && meta.sizeBytes > MAX_ANIMATED_FILE_BYTES) {
      this.onSizeLimitExceeded?.(meta);
      return false;
    }

    try {
      const res = await fetch(imgSrc);
      if (sid !== this.sessionId) return false;
      const buf = await res.arrayBuffer();
      if (sid !== this.sessionId) return false;
      if (buf.byteLength > MAX_ANIMATED_FILE_BYTES) {
        this.onSizeLimitExceeded?.(meta);
        return false;
      }

      const decoder = new ImageDecoder({ data: buf, type: mimeType });
      await decoder.tracks.ready;
      if (sid !== this.sessionId) { try { decoder.close(); } catch (_) {} return false; }

      const track = decoder.tracks.selectedTrack;
      if (!track || track.frameCount <= 1) { try { decoder.close(); } catch (_) {} return false; }

      this.decoder = decoder;
      this.track = track;
      this.frameCount = track.frameCount;
      this.repetitionCount = Number.isFinite(track.repetitionCount) ? track.repetitionCount : Infinity;
      this.completedLoops = 0;
      this.frameIndex = 0;
      this.animated = true;

      const first = await decoder.decode({ frameIndex: 0 });
      if (sid !== this.sessionId) { try { first?.image?.close(); } catch (_) {} return false; }

      this._setCurrentFrame(first.image, this._getDurationMs(first.image));
      this._prefetchNext(sid);
      this.playing = true;
      this.userPaused = false;
      this.lastFrameTime = performance.now();
      this._scheduleTick(sid);
      return true;
    } catch (_) {
      if (sid === this.sessionId) this.dispose();
      return false;
    }
  }

  play(fromUser = true) {
    if (!this.animated || !this.decoder) return false;
    if (!fromUser && this.userPaused) return false;
    if (fromUser) this.userPaused = false;
    if (this.playing) return true;
    if (this.completedLoops > this.repetitionCount) {
      this.completedLoops = 0;
      this.frameIndex = -1;
      this._prefetchNext(this.sessionId);
    }
    this.playing = true;
    this.lastFrameTime = performance.now();
    this._scheduleTick(this.sessionId);
    return true;
  }

  pause(fromUser = true) {
    if (!this.animated) return false;
    if (fromUser) this.userPaused = true;
    this.playing = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    return true;
  }

  togglePlay() {
    if (!this.animated) return null;
    if (this.playing) { this.pause(true); return false; }
    this.play(true);
    return true;
  }

  dispose() {
    this.sessionId++;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.playing = false;
    this.userPaused = false;
    this.animated = false;
    this.frameCount = 0;
    this.frameIndex = 0;
    this.completedLoops = 0;
    this.nextFrameIndex = -1;

    const pending = this.nextFramePromise;
    this.nextFramePromise = null;
    if (pending) pending.then((r) => { try { r?.image?.close(); } catch (_) {} }).catch(() => {});
    if (this.currentFrame) { try { this.currentFrame.close(); } catch (_) {} this.currentFrame = null; }
    if (this.decoder) { try { this.decoder.close(); } catch (_) {} this.decoder = null; }
    this.track = null;
    return this.sessionId;
  }

  _getDurationMs(videoFrame) {
    const us = videoFrame?.duration;
    return ((!us || us < 20_000) ? 100_000 : us) / 1000;
  }

  _setCurrentFrame(videoFrame, durationMs) {
    const prev = this.currentFrame;
    this.currentFrame = videoFrame;
    this.currentFrameDurationMs = durationMs;
    this.onFrame?.(videoFrame);
    if (prev) { try { prev.close(); } catch (_) {} }
  }

  _prefetchNext(sid) {
    if (!this.decoder || !this.animated || sid !== this.sessionId) return;
    let nextIdx = this.frameIndex + 1;
    if (nextIdx >= this.frameCount) {
      if (this.completedLoops + 1 > this.repetitionCount) return;
      nextIdx = 0;
    }
    this.nextFrameIndex = nextIdx;
    this.nextFramePromise = this.decoder.decode({ frameIndex: nextIdx }).catch(() => null);
  }

  _scheduleTick(sid) {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame((now) => this._tick(sid, now));
  }

  async _tick(sid, now) {
    this.rafId = null;
    if (!this.playing || !this.animated || sid !== this.sessionId) return;
    if (now - this.lastFrameTime < this.currentFrameDurationMs) { this._scheduleTick(sid); return; }

    if (this.frameIndex + 1 >= this.frameCount) {
      this.completedLoops++;
      if (this.completedLoops > this.repetitionCount) { this.playing = false; return; }
    }

    if (this.nextFramePromise) {
      const pending = this.nextFramePromise;
      const targetIdx = this.nextFrameIndex;
      this.nextFramePromise = null;
      this.nextFrameIndex = -1;
      const res = await pending;
      if (sid !== this.sessionId || !this.animated) { try { res?.image?.close(); } catch (_) {} return; }
      if (res?.image) {
        this.frameIndex = targetIdx;
        this._setCurrentFrame(res.image, this._getDurationMs(res.image));
        this.lastFrameTime = performance.now();
        this._prefetchNext(sid);
      }
    }

    if (this.playing && sid === this.sessionId) this._scheduleTick(sid);
  }
}
