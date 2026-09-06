/**
 * Bukaake File & Batch Navigation Service
 * Handles Tauri local disk paths, directory sibling batching, File objects, drag-drop, and clipboard
 */

import { tauriBridge } from './tauri-bridge.js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export class FileLoader {
  constructor() {
    this.items = [];
    this.currentIndex = -1;
    this.currentImage = null;
    this.currentMeta = null;

    this.onImageLoaded = null; this.onListChanged = null;
    this.onStatusMessage = null; this.onStatusWarning = null; this.onAllFilesCleared = null;
  }

  get totalFiles() { return this.items.length; }

  bindDropAndPaste(viewportEl, fileInputEl) {
    fileInputEl?.addEventListener('change', (e) => this.loadWebFiles(e.target.files));
    document.getElementById('dropOpenBtn')?.addEventListener('click', () => {
      if (this.onPromptOpen) this.onPromptOpen();
      else fileInputEl?.click();
    });
    document.getElementById('dropPasteBtn')?.addEventListener('click', () => this.loadFromClipboard());

    let lastDropTime = 0;
    let lastDropFingerprint = '';

    const handlePaths = async (paths) => {
      viewportEl?.classList.remove('drag-over');
      if (!paths || paths.length === 0) return;

      const now = Date.now();
      const fingerprint = paths.map((p) => p.replace(/\\/g, '/').toLowerCase()).join('|');
      if (now - lastDropTime < 400 && lastDropFingerprint === fingerprint) return;
      lastDropTime = now;
      lastDropFingerprint = fingerprint;

      const targetPath = paths[0];
      const payload = await tauriBridge.readImageContext(targetPath);
      if (payload) {
        this.loadFromTauriContext(payload);
      } else {
        const fileName = targetPath.split(/[/\\]/).pop() || targetPath;
        this.onStatusWarning?.(`Unsupported file format: ${fileName}`);
      }
    };

    if (tauriBridge.isTauri()) {
      const attachDrop = (target) => {
        if (!target?.onDragDropEvent) return;
        target.onDragDropEvent((event) => {
          const p = event?.payload;
          if (!p) return;
          if (p.type === 'drop') {
            viewportEl?.classList.remove('drag-over');
            if (p.paths?.length > 0) handlePaths(p.paths);
          } else if (p.type === 'enter' || p.type === 'over') {
            viewportEl?.classList.add('drag-over');
          } else if (p.type === 'leave' || p.type === 'cancel') {
            viewportEl?.classList.remove('drag-over');
          }
        });
      };
      try { attachDrop(getCurrentWindow()); } catch (e) {}
      try { attachDrop(getCurrentWebview()); } catch (e) {}
    }

    const onDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      viewportEl?.classList.add('drag-over');
    };
    window.addEventListener('dragenter', (e) => e.preventDefault());
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) viewportEl?.classList.remove('drag-over'); });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      viewportEl?.classList.remove('drag-over');
      if (e.dataTransfer?.files?.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const paths = files.map((f) => f.path).filter(Boolean);
        if (paths.length > 0) return handlePaths(paths);
        this.loadWebFiles(files);
      }
    });

    window.addEventListener('paste', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.clipboardData?.files?.length > 0) return this.loadWebFiles(e.clipboardData.files);
      if (e.clipboardData?.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) return this.loadWebFiles([file]);
          }
        }
      }
      if (tauriBridge.isTauri()) this.loadFromClipboard();
    });
  }

  loadFromTauriContext(payload) {
    if (!payload || !payload.target_path) return;

    this.items = payload.neighbors?.length > 0
      ? payload.neighbors.map((n) => ({ type: 'tauri', path: n.path, name: n.name, sizeBytes: n.size_bytes }))
      : [{ type: 'tauri', path: payload.target_path, name: payload.file_name, sizeBytes: payload.size_bytes }];
    this.currentIndex = payload.neighbors?.length > 0 && payload.current_index >= 0 ? payload.current_index : 0;

    this.emitListChanged();
    this.createImageFromUrl(payload.data_url, {
      name: payload.file_name,
      path: payload.target_path,
      sizeBytes: payload.size_bytes,
      dimensions: payload.dimensions,
      mimeType: payload.mime_type,
      lastModified: payload.last_modified,
      exif: payload.exif,
    });
  }

  async loadItemAtIndex(index) {
    if (index < 0 || index >= this.items.length) return;
    this.currentIndex = index;
    this.emitListChanged();

    const item = this.items[index];
    if (item.type === 'tauri') {
      try {
        const payload = await tauriBridge.readImageFile(item.path);
        if (payload?.data_url) {
          this.createImageFromUrl(payload.data_url, {
            name: payload.file_name,
            path: payload.path,
            sizeBytes: payload.size_bytes,
            dimensions: payload.dimensions,
            mimeType: payload.mime_type,
            lastModified: payload.last_modified,
            exif: payload.exif,
          });
        }
      } catch (err) {
        this.onStatusMessage?.(`Failed to read ${item.name}`);
      }
    } else if (item.type === 'file') {
      this.readWebFile(item.fileObj);
    }
  }

  async navigateBatch(delta) {
    if (this.items.length <= 1) return;
    const nextIndex = (this.currentIndex + delta + this.items.length) % this.items.length;
    await this.loadItemAtIndex(nextIndex);
  }

  async deleteCurrent(toTrash = true) {
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) {
      return { success: false, remaining: this.items.length };
    }

    const item = this.items[this.currentIndex];
    const deletedName = item.name || 'image';

    if (item.type === 'tauri' && item.path) {
      await tauriBridge.deleteFile(item.path, toTrash);
    }

    this.items.splice(this.currentIndex, 1);

    if (this.items.length === 0) {
      this.currentIndex = -1;
      this.currentImage = null;
      this.currentMeta = null;
      this.emitListChanged();
      this.onAllFilesCleared?.();
      return { success: true, remaining: 0, deletedName };
    }

    if (this.currentIndex >= this.items.length) {
      this.currentIndex = this.items.length - 1;
    }

    await this.loadItemAtIndex(this.currentIndex);
    return { success: true, remaining: this.items.length, deletedName };
  }

  loadWebFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const isImg = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp|ico|svg|tiff?)$/i.test(f.name);
    const valid = Array.from(fileList).filter(isImg);
    if (valid.length === 0) {
      const fileName = fileList[0]?.name || 'file';
      this.onStatusWarning?.(`Unsupported file format: ${fileName}`);
      return;
    }
    this.items = valid.map((f) => ({ type: 'file', fileObj: f, name: f.name, sizeBytes: f.size }));
    this.currentIndex = 0;
    this.emitListChanged();
    this.readWebFile(this.items[0].fileObj);
  }

  readWebFile(fileObj) {
    const reader = new FileReader();
    reader.onload = (e) => this.createImageFromUrl(e.target.result, {
      name: fileObj.name, path: null, sizeBytes: fileObj.size,
      fileObj, mimeType: fileObj.type, lastModified: fileObj.lastModified,
    });
    reader.readAsDataURL(fileObj);
  }

  loadDirectImage(img, meta = {}) {
    this.currentImage = img;
    this.currentMeta = { ...(this.currentMeta || {}), ...meta };
    this.onImageLoaded?.(img, this.currentMeta);
  }

  createImageFromUrl(url, meta) {
    const img = new Image();
    img.onload = () => {
      this.currentImage = img;
      this.currentMeta = {
        ...meta,
        naturalWidth: img.naturalWidth || img.width,
        naturalHeight: img.naturalHeight || img.height,
      };
      this.onImageLoaded?.(img, this.currentMeta);
    };
    img.onerror = () => {
      this.onStatusMessage?.(`Failed to display ${meta.name || 'image'}`);
    };
    img.src = url;
  }

  async loadFromClipboard() {
    if (tauriBridge.isTauri()) {
      try {
        const payload = await tauriBridge.readClipboard();
        if (payload) {
          if (payload.payload_type === 'path' && payload.data) {
            const ctx = await tauriBridge.readImageContext(payload.data);
            if (ctx) {
              this.loadFromTauriContext(ctx);
              return true;
            }
          } else if (payload.payload_type === 'image' && payload.data) {
            const approxBytes = Math.round((payload.data.length * 3) / 4);
            this.items = [{ type: 'clipboard', name: 'Clipboard Image', sizeBytes: approxBytes }];
            this.currentIndex = 0;
            this.emitListChanged();
            this.createImageFromUrl(payload.data, { name: 'Clipboard Image', path: null, sizeBytes: approxBytes });
            return true;
          }
        }
        this.onStatusWarning?.('No image found in clipboard');
        return false;
      } catch (err) {
        console.warn('Native clipboard read error:', err);
        this.onStatusWarning?.('Unable to read clipboard');
        return false;
      }
    }

    try {
      if (!navigator.clipboard?.read) {
        this.onStatusMessage?.('Clipboard API unsupported in browser');
        return false;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], 'clipboard_image.png', { type: 'image/png' });
            this.loadWebFiles([file]);
            return true;
          }
        }
      }
      this.onStatusMessage?.('No image found in clipboard');
      return false;
    } catch (_) {
      this.onStatusMessage?.('Clipboard access unavailable');
      return false;
    }
  }

  emitListChanged() {
    this.onListChanged?.(this.items.length, this.currentIndex);
  }
}
