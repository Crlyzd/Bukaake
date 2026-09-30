/**
 * Bukaake Screen Snipper OCR Submodule
 * Coordinates glowing rainbow border animation, OCR service dispatch, and completion lifecycle (< 90 lines)
 */

import { ocrService } from '../../services/capture/ocr-service.js';

export class SnipperOcr {
  constructor() {
    this.isProcessing = false;
  }

  async runOcr({ dataUrl, rect, sourceImg, boxEl, actionDockEl, onFinish }) {
    if (this.isProcessing) return;
    if (!rect || rect.width <= 5 || rect.height <= 5) return;

    this.isProcessing = true;

    // 1. Activate Animated Glowing Rainbow Border on the selection box
    if (boxEl) {
      boxEl.classList.add('loading-ocr');
    }

    // 2. Hide action dock to prevent duplicate interactions
    if (actionDockEl) {
      actionDockEl.classList.add('hidden');
    }

    try {
      // 3. Execute OCR extraction (copies to clipboard, auto-opens Cathet if enabled)
      await ocrService.extractTextFromRegion(dataUrl, rect, sourceImg);
    } catch (err) {
      console.error('[SnipperOcr] Execution error:', err);
    } finally {
      this.isProcessing = false;
      if (boxEl) {
        boxEl.classList.remove('loading-ocr');
      }
      onFinish?.();
    }
  }
}

export const snipperOcr = new SnipperOcr();
