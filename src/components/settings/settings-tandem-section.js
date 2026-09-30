/**
 * Bukaake Settings Tandem Section Controller
 * Encapsulates companion editor workflows for Alitken (Video) and Cathet (Text) (< 90 lines)
 */

import { alitkenService } from '../../services/alitken-service.js';
import { cathetService } from '../../services/cathet-service.js';

export function bindTandemSettings() {
  // 1. Alitken Tandem (Video Converter & Splitter)
  const inputAlitken = document.getElementById('inputAlitkenPath');
  const btnBrowseAlitken = document.getElementById('btnBrowseAlitken');
  const toggleAlitken = document.getElementById('toggleAlitkenAuto');

  if (inputAlitken) {
    inputAlitken.value = alitkenService.getCustomPath() || 'Auto-Detect (./AlitConverter.exe)';
  }

  btnBrowseAlitken?.addEventListener('click', async () => {
    const path = await alitkenService.pickCustomExecutable();
    if (path && inputAlitken) inputAlitken.value = path;
  });

  if (toggleAlitken) {
    toggleAlitken.checked = alitkenService.isAutoOpenEnabled();
    toggleAlitken.addEventListener('change', () => {
      alitkenService.setAutoOpen(toggleAlitken.checked);
    });
  }

  // 2. Cathet Tandem (Markdown & Scratchpad)
  const inputCathet = document.getElementById('inputCathetPath');
  const btnBrowseCathet = document.getElementById('btnBrowseCathet');
  const toggleCathet = document.getElementById('toggleCathetAuto');

  if (inputCathet) {
    inputCathet.value = cathetService.getCustomPath() || 'Auto-Detect (./Cathet.exe)';
  }

  btnBrowseCathet?.addEventListener('click', async () => {
    const path = await cathetService.pickCustomExecutable();
    if (path && inputCathet) inputCathet.value = path;
  });

  if (toggleCathet) {
    toggleCathet.checked = cathetService.isAutoOpenEnabled();
    toggleCathet.addEventListener('change', () => {
      cathetService.setAutoOpen(toggleCathet.checked);
    });
  }
}
