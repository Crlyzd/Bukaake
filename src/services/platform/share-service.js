/**
 * Bukaake Native Windows Share Service
 * Dispatches local file paths or rendered PNG bytes to the Windows Share UI (< 120 lines)
 */

import { toast } from '../../components/viewer/toast.js';
import { i18n } from './i18n-service.js';

export class ShareService {
  get invoke() {
    return typeof window !== 'undefined' ? window.__TAURI__?.core?.invoke : null;
  }

  notifyShareFailed() {
    const message = i18n.t('toasts.shareFailed');
    const isSnipper = typeof window !== 'undefined' && (
      window.__TAURI__?.webviewWindow?.getCurrentWebviewWindow?.()?.label === 'snipper'
      || window.location?.pathname?.includes('snipper')
    );
    if (isSnipper && window.__TAURI__?.event?.emit) {
      window.__TAURI__.event.emit('bukaake://show-toast', { message, type: 'warning' }).catch(() => {});
    } else {
      toast.warn(message);
    }
    return false;
  }

  async sharePath(path) {
    if (!path || !this.invoke) return this.notifyShareFailed();
    try {
      await this.invoke('share_image', { path });
      return true;
    } catch (err) {
      console.warn('[ShareService] share_image failed:', err);
      return this.notifyShareFailed();
    }
  }

  async shareBytes(bytes, filename = 'Bukaake_Share.png') {
    if (!bytes || !this.invoke) return this.notifyShareFailed();
    try {
      await this.invoke('share_image_bytes', {
        bytes: Array.from(bytes),
        filename,
      });
      return true;
    } catch (err) {
      console.warn('[ShareService] share_image_bytes failed:', err);
      return this.notifyShareFailed();
    }
  }

  async shareViewerImage({ filePath, isModified, canvasViewer, filters } = {}) {
    const hasTransforms = Boolean(
      canvasViewer && ((canvasViewer.rotation % 360) !== 0 || canvasViewer.flipH || canvasViewer.flipV)
    );

    if (filePath && !isModified && !hasTransforms) {
      return this.sharePath(filePath);
    }

    if (!canvasViewer?.img && !canvasViewer?.canvas) {
      toast.warn(i18n.t('toasts.shareFailed'));
      return false;
    }

    try {
      const filterCss = filters?.getFilterCssString?.() || '';
      const offscreen = canvasViewer.getProcessedCanvas
        ? canvasViewer.getProcessedCanvas(null, filterCss)
        : canvasViewer.canvas;

      if (!offscreen) {
        toast.warn(i18n.t('toasts.shareFailed'));
        return false;
      }

      const blob = await new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'));
      if (!blob) {
        toast.warn(i18n.t('toasts.shareFailed'));
        return false;
      }

      const buffer = await blob.arrayBuffer();
      const base = filePath ? filePath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, '') : 'Bukaake_Share';
      const suggestedName = `${base}_edited.png`;
      return this.shareBytes(new Uint8Array(buffer), suggestedName);
    } catch (err) {
      console.warn('[ShareService] shareViewerImage failed:', err);
      toast.warn(i18n.t('toasts.shareFailed'));
      return false;
    }
  }
}

export const shareService = new ShareService();
