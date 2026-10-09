/**
 * Bukaake Image Export & Save Service
 * Handles Tauri local disk save prompts, native file writes, and Web FileSystem access (< 70 lines)
 */

import { tauriBridge } from '../platform/tauri-bridge.js';
import { changeTracker } from '../interaction/change-tracker.js';
import { toast } from '../../components/viewer/toast.js';

function getEditTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export async function exportImage(viewer, filters, fileLoader, isCropActive, isDrawActive, isTextActive) {
  if (!viewer.img) { toast.show('No image loaded to save'); return false; }
  if (isCropActive) { toast.show('Please apply or cancel crop before saving'); return false; }
  if (isDrawActive) { toast.show('Please apply or cancel drawing before saving'); return false; }
  if (isTextActive) { toast.show('Please apply or cancel text before saving'); return false; }

  const off = viewer.getProcessedCanvas(null, filters.getFilterCssString());
  if (!off) return false;

  const base = fileLoader.currentMeta?.name?.replace(/\.[^/.]+$/, '') || 'bukaake_export';
  const timestamp = getEditTimestamp();
  const defaultName = `${base}_edited_${timestamp}.png`;
  const dataUrl = off.toDataURL('image/png');

  if (tauriBridge.isTauri()) {
    const chosen = await tauriBridge.promptSaveFile(defaultName, 'png');
    if (!chosen) return false;
    try {
      await tauriBridge.saveImageBytes(chosen, dataUrl);
      changeTracker.markSaved();
      const fname = chosen.split(/[\\/]/).pop();
      toast.show(`Saved ${fname}`);
      return true;
    } catch {
      toast.show('Failed to save image');
      return false;
    }
  }

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
      });
      const blob = await new Promise((res) => off.toBlob(res, 'image/png'));
      const wr = await handle.createWritable();
      await wr.write(blob);
      await wr.close();
      changeTracker.markSaved();
      toast.show(`Saved ${defaultName}`);
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') toast.show('Save failed');
      return false;
    }
  }

  const link = document.createElement('a');
  link.download = defaultName;
  link.href = dataUrl;
  link.click();
  changeTracker.markSaved();
  toast.show(`Exported ${defaultName}`);
  return true;
}

export function copyProcessedImage(viewer, filters) {
  if (!viewer.img) return toast.show('No image loaded to copy');
  const off = viewer.getProcessedCanvas(null, filters.getFilterCssString());
  if (!off) return;

  if (tauriBridge.isTauri()) {
    const dataUrl = off.toDataURL('image/png');
    tauriBridge.writeClipboardImage(dataUrl).then((ok) => {
      if (ok) {
        toast.show('Image copied to clipboard');
      } else {
        toast.show('Clipboard copy unsupported');
      }
    }).catch(() => {
      toast.show('Clipboard copy unsupported');
    });
    return;
  }

  off.toBlob(async (b) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      toast.show('Image copied to clipboard');
    } catch {
      toast.show('Clipboard copy unsupported');
    }
  }, 'image/png');
}

export async function setAsWallpaper(viewer, filters, fileLoader, isCropActive, isDrawActive, isTextActive) {
  if (!viewer?.img) { toast.show('No image loaded to set as wallpaper'); return false; }
  if (isCropActive) { toast.show('Please apply or cancel crop first'); return false; }
  if (isDrawActive) { toast.show('Please apply or cancel drawing first'); return false; }
  if (isTextActive) { toast.show('Please apply or cancel text first'); return false; }

  if (!tauriBridge.isTauri()) {
    toast.show('Wallpaper setting is only available on desktop');
    return false;
  }

  try {
    const isDirty = changeTracker.hasUnsavedChanges();
    const filePath = fileLoader?.currentMeta?.path;
    const ext = (filePath?.split('.').pop() || '').toLowerCase();
    const isStandard = ['jpg', 'jpeg', 'png', 'bmp'].includes(ext);

    if (isDirty || !isStandard || !filePath) {
      const off = viewer.getProcessedCanvas(null, filters.getFilterCssString());
      if (!off) return false;
      const dataUrl = off.toDataURL('image/png');
      await tauriBridge.invoke('set_wallpaper', { base64Data: dataUrl });
    } else {
      await tauriBridge.invoke('set_wallpaper', { path: filePath });
    }

    toast.show('Desktop wallpaper updated', 'ri-landscape-line');
    return true;
  } catch (err) {
    console.warn('[ImageSaver] setAsWallpaper failed:', err);
    toast.warn('Failed to set desktop wallpaper');
    return false;
  }
}
