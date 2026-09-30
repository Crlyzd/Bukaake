/**
 * Bukaake Screen OCR Service
 * Coordinates region cropping, native WinRT OCR invocation, clipboard copying, and Cathet handoff (< 120 lines)
 */

import { invoke } from '@tauri-apps/api/core';
import { screenCaptureService } from './screen-capture-service.js';
import { cathetService } from '../integrations/cathet-service.js';
import { toast } from '../../components/viewer/toast.js';

export class OcrService {
  async extractTextFromRegion(dataUrl, rect, sourceImg) {
    if (!dataUrl || !rect || rect.width <= 5 || rect.height <= 5) {
      toast.show('Selection too small for text recognition', 'info');
      return null;
    }

    try {
      const croppedUrl = await screenCaptureService.cropCapturedRegion(dataUrl, rect, sourceImg);
      const payload = await invoke('extract_text_from_image', { base64Data: croppedUrl });

      const text = payload?.text?.trim() || '';
      if (!text) {
        toast.show('No text detected in selected region', 'info');
        return { text: '', wordCount: 0, lineCount: 0 };
      }

      // Copy text directly to clipboard
      try {
        await navigator.clipboard.writeText(text);
      } catch (clipErr) {
        console.warn('[OcrService] navigator.clipboard failed, fallback to input select:', clipErr);
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      // Auto-open in Cathet if enabled
      if (cathetService.isAutoOpenEnabled()) {
        cathetService.launch(text).catch((err) => {
          console.error('[OcrService] Cathet launch error:', err);
        });
      }

      const snippet = text.length > 36 ? `${text.slice(0, 36)}...` : text;
      const countMsg = payload.word_count > 0 ? ` (${payload.word_count} words)` : '';
      toast.show(`Copied: "${snippet}"${countMsg}`, 'info');

      return {
        text,
        wordCount: payload.word_count,
        lineCount: payload.line_count,
      };
    } catch (err) {
      console.error('[OcrService] Extraction failed:', err);
      toast.show(typeof err === 'string' ? err : (err?.message || 'Failed to extract text'), 'error');
      return null;
    }
  }
}

export const ocrService = new OcrService();
