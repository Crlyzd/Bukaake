/**
 * Bukaake File & Batch Navigation Service
 * Handles Tauri local disk paths, directory sibling batching, File objects, drag-drop, and clipboard
 */

import { tauriBridge } from './tauri-bridge.js';

export class FileLoader {
  constructor() {
    this.items = [];
    this.currentIndex = -1;
    this.currentImage = null;
    this.currentMeta = null;

    this.onImageLoaded = null;
    this.onListChanged = null;
    this.onStatusMessage = null;
  }

  get totalFiles() {
    return this.items.length;
  }

  bindDropAndPaste(viewportEl, fileInputEl) {
    fileInputEl?.addEventListener('change', (e) => this.loadWebFiles(e.target.files));
    document.getElementById('dropOpenBtn')?.addEventListener('click', () => fileInputEl?.click());

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      viewportEl?.classList.add('drag-over');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) viewportEl?.classList.remove('drag-over');
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      viewportEl?.classList.remove('drag-over');
      if (e.dataTransfer?.files?.length > 0) {
        this.loadWebFiles(e.dataTransfer.files);
      }
    });

    window.addEventListener('paste', (e) => {
      if (e.clipboardData?.files?.length > 0) {
        this.loadWebFiles(e.clipboardData.files);
      }
    });
  }

  loadFromTauriContext(payload) {
    if (!payload || !payload.target_path) return;

    if (payload.neighbors && payload.neighbors.length > 0) {
      this.items = payload.neighbors.map((n) => ({
        type: 'tauri',
        path: n.path,
        name: n.name,
        sizeBytes: n.size_bytes,
      }));
      this.currentIndex = payload.current_index >= 0 ? payload.current_index : 0;
    } else {
      this.items = [
        {
          type: 'tauri',
          path: payload.target_path,
          name: payload.file_name,
          sizeBytes: payload.size_bytes,
        },
      ];
      this.currentIndex = 0;
    }

    this.emitListChanged();
    this.createImageFromUrl(payload.data_url, {
      name: payload.file_name,
      path: payload.target_path,
      sizeBytes: payload.size_bytes,
      dimensions: payload.dimensions,
    });
  }

  async navigateBatch(delta) {
    if (this.items.length <= 1) return;

    const nextIndex = (this.currentIndex + delta + this.items.length) % this.items.length;
    this.currentIndex = nextIndex;
    this.emitListChanged();

    const item = this.items[this.currentIndex];
    if (item.type === 'tauri') {
      try {
        const payload = await tauriBridge.readImageFile(item.path);
        if (payload && payload.data_url) {
          this.createImageFromUrl(payload.data_url, {
            name: payload.file_name,
            path: payload.path,
            sizeBytes: payload.size_bytes,
            dimensions: payload.dimensions,
          });
        }
      } catch (err) {
        this.onStatusMessage?.(`Failed to read ${item.name}`);
      }
    } else if (item.type === 'file') {
      this.readWebFile(item.fileObj);
    }
  }

  loadWebFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const valid = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) {
      this.onStatusMessage?.('No valid image files selected.');
      return;
    }
    this.items = valid.map((f) => ({ type: 'file', fileObj: f, name: f.name, sizeBytes: f.size }));
    this.currentIndex = 0;
    this.emitListChanged();
    this.readWebFile(this.items[0].fileObj);
  }

  readWebFile(fileObj) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.createImageFromUrl(e.target.result, {
        name: fileObj.name,
        path: null,
        sizeBytes: fileObj.size,
        fileObj,
      });
    };
    reader.readAsDataURL(fileObj);
  }

  loadDirectImage(imageElement, meta = {}) {
    this.currentImage = imageElement;
    this.currentMeta = meta;
    this.onImageLoaded?.(imageElement, meta);
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
      if (meta.name) this.onStatusMessage?.(`Loaded ${meta.name}`);
    };
    img.onerror = () => {
      this.onStatusMessage?.(`Failed to display ${meta.name || 'image'}`);
    };
    img.src = url;
  }

  async loadFromClipboard() {
    try {
      if (!navigator.clipboard?.read) throw new Error('Clipboard API unavailable');
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
    } catch (err) {
      this.onStatusMessage?.('Clipboard access denied or unsupported');
      return false;
    }
  }

  emitListChanged() {
    this.onListChanged?.(this.items.length, this.currentIndex);
  }
}
