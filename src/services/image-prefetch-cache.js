/**
 * Bukaake Image Prefetch & Sliding Window Cache
 * Asymmetric 5-slot pre-decoder with Smart Adaptive Memory Guardrails
 * Prevents RAM flooding on massive VFX/Pro formats (EXR, HDR, TIFF)
 */

import { tauriBridge } from './tauri-bridge.js';

const MAX_PREFETCH_FILE_SIZE = 40 * 1024 * 1024; // 40 MB single-file prefetch limit
const MAX_TOTAL_CACHE_BYTES = 140 * 1024 * 1024; // 140 MB cumulative safety ceiling
const HEAVY_FILE_THRESHOLD = 30 * 1024 * 1024;   // 30 MB threshold to throttle runway

export class ImagePrefetchCache {
  constructor() {
    this.cache = new Map();
    this.currentSessionId = 0;
    this.debounceTimer = null;
  }

  get(path) {
    if (!path) return null;
    const entry = this.cache.get(path);
    if (entry?.img?.complete && (entry.img.naturalWidth || entry.img.width)) {
      return entry;
    }
    return null;
  }

  getEstimatedCacheBytes() {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry?.meta?.sizeBytes || (4 * 1024 * 1024);
    }
    return total;
  }

  update(items, currentIndex) {
    if (!items || items.length <= 1 || currentIndex < 0 || currentIndex >= items.length) {
      this.evictExcept(new Set(items?.[currentIndex]?.path ? [items[currentIndex].path] : []));
      return;
    }

    const currentItem = items[currentIndex];
    const currentSize = currentItem?.sizeBytes || 0;

    // Strict Monolith Protection: If active file exceeds 120MB, skip prefetching entirely
    if (currentSize > MAX_TOTAL_CACHE_BYTES) {
      this.evictExcept(new Set([currentItem.path]));
      return;
    }

    const total = items.length;
    // Adaptive Runway: Heavy files (> 30MB) throttle to [+1] only; normal files use [-1, +1, +2, +3]
    const isHeavy = currentSize > HEAVY_FILE_THRESHOLD;
    const offsets = isHeavy ? [1] : [1, -1, 2, 3];

    const uniqueIndices = [...new Set(offsets.map((d) => (currentIndex + d + total) % total))]
      .filter((idx) => idx !== currentIndex && idx >= 0 && idx < total);

    const validPaths = new Set([currentItem?.path, ...uniqueIndices.map((i) => items[i]?.path)].filter(Boolean));
    this.evictExcept(validPaths);

    this.currentSessionId++;
    const sessionId = this.currentSessionId;
    clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(async () => {
      let cumulativeBytes = this.getEstimatedCacheBytes();

      for (const idx of uniqueIndices) {
        if (sessionId !== this.currentSessionId) break;
        const item = items[idx];
        if (!item || item.type !== 'tauri' || !item.path || this.cache.has(item.path)) continue;

        const itemSize = item.sizeBytes || 0;

        // Skip massive files individually (> 40MB) or if cumulative cache exceeds ceiling
        if (itemSize > MAX_PREFETCH_FILE_SIZE) continue;
        if (cumulativeBytes + itemSize > MAX_TOTAL_CACHE_BYTES) break;

        try {
          const payload = await tauriBridge.readImageFile(item.path);
          if (sessionId !== this.currentSessionId || !payload?.data_url) break;

          const img = new Image();
          img.src = payload.data_url;

          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }

          if (sessionId !== this.currentSessionId) break;

          cumulativeBytes += payload.size_bytes || itemSize;
          this.cache.set(item.path, {
            img,
            meta: {
              name: payload.file_name,
              path: payload.path,
              sizeBytes: payload.size_bytes,
              dimensions: payload.dimensions,
              mimeType: payload.mime_type,
              lastModified: payload.last_modified,
              exif: payload.exif,
              naturalWidth: img.naturalWidth || img.width,
              naturalHeight: img.naturalHeight || img.height,
            },
          });
        } catch (_) {}
      }
    }, 120);
  }

  evictExcept(validPaths) {
    for (const [path, entry] of this.cache.entries()) {
      if (!validPaths.has(path)) {
        if (entry?.img) entry.img.src = '';
        this.cache.delete(path);
      }
    }
  }

  evict(path) {
    if (!path) return;
    const entry = this.cache.get(path);
    if (entry?.img) entry.img.src = '';
    this.cache.delete(path);
  }

  clear() {
    this.currentSessionId++;
    clearTimeout(this.debounceTimer);
    for (const entry of this.cache.values()) {
      if (entry?.img) entry.img.src = '';
    }
    this.cache.clear();
  }
}
