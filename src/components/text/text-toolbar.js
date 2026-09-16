/**
 * Bukaake Floating Glass Text Sub-Toolbar Component
 * Coordinates font, size, styles (B/I/U/S), Canva-style Shadow & Background popovers (< 260 lines).
 */

import { TEXT_SIZE_MIN, TEXT_SIZE_MAX, sliderRatioToTextSize, textSizeToSliderRatio, stepTextSize } from '../../core/text/text-renderer.js';

export class TextToolbar {
  constructor(textTool, options = {}) {
    this.tool = textTool;
    this.actions = options;
    this.container = document.getElementById('textToolbar');

    this.init();
  }

  init() {
    this.bindPopovers();
    this.bindTypographyControls();
    this.bindEffectsTabs();
    this.bindShadowControls();
    this.bindBackgroundControls();
    this.bindHistoryAndActions();

    this.tool.onHistoryChange = ({ canUndo, canRedo }) => {
      const u = document.getElementById('btnTextUndo'), r = document.getElementById('btnTextRedo');
      if (u) u.disabled = !canUndo;
      if (r) r.disabled = !canRedo;
    };

    this.tool.onActiveChange = (item) => this.updateSelectionState(item);
    this.tool.onReset = () => this.resetUI();
    this.updateSelectionState(this.tool.activeItem);
  }

  bindPopovers() {
    const triggers = [
      { btn: 'btnTextFontPop', pop: 'textFontPopover' },
      { btn: 'btnTextSizePop', pop: 'textSizePopover' },
      { btn: 'btnTextColorPop', pop: 'textColorPopover' },
      { btn: 'btnTextEffectsPop', pop: 'textEffectsPopover' },
    ];

    triggers.forEach(({ btn, pop }) => {
      document.getElementById(btn)?.addEventListener('click', (e) => {
        e.stopPropagation();
        const pEl = document.getElementById(pop);
        const willOpen = pEl?.classList.contains('hidden');
        this.closeAllPopovers();
        if (willOpen && pEl) {
          pEl.classList.remove('hidden');
          document.getElementById(btn)?.classList.add('active');
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#textToolbar, .text-popover')) this.closeAllPopovers();
    });
  }

  bindEffectsTabs() {
    const tabs = [
      { btn: 'tabBtnShadow', panel: 'panelTextShadow' },
      { btn: 'tabBtnBg', panel: 'panelTextBg' },
    ];
    tabs.forEach(({ btn, panel }) => {
      document.getElementById(btn)?.addEventListener('click', (e) => {
        e.stopPropagation();
        tabs.forEach((t) => {
          document.getElementById(t.btn)?.classList.remove('active');
          document.getElementById(t.panel)?.classList.add('hidden');
        });
        document.getElementById(btn)?.classList.add('active');
        document.getElementById(panel)?.classList.remove('hidden');
      });
    });
  }

  closeAllPopovers() {
    document.querySelectorAll('.text-popover').forEach((p) => p.classList.add('hidden'));
    document.querySelectorAll('#textToolbar .text-pill-btn').forEach((b) => b.classList.remove('active'));
  }

  bindTypographyControls() {
    document.querySelectorAll('.text-font-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const font = opt.getAttribute('data-font');
        document.querySelectorAll('.text-font-option').forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');
        const badge = document.getElementById('textFontBadge');
        if (badge) badge.textContent = opt.textContent;
        this.tool.currentFont = font;
        this.tool.updateActiveItem({ font }, true);
        this.closeAllPopovers();
      });
    });

    const sizeTrack = document.getElementById('textSizeTrack'), sizePop = document.getElementById('textSizePopover'), btnSize = document.getElementById('btnTextSizePop');
    const setSize = (px, pushHistory = false) => {
      const val = this.updateSliderUI(px);
      this.tool.currentSize = val;
      this.tool.updateActiveItem({ size: val }, pushHistory);
    };
    this.updateSliderUI(this.tool.currentSize || 36);

    let draggingSize = false;
    const onTrack = (e) => {
      if (!sizeTrack) return;
      const rect = sizeTrack.getBoundingClientRect();
      const r = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
      setSize(sliderRatioToTextSize(r), false);
    };
    sizeTrack?.addEventListener('mousedown', (e) => { e.stopPropagation(); draggingSize = true; onTrack(e); });
    window.addEventListener('mousemove', (e) => { if (draggingSize) onTrack(e); });
    window.addEventListener('mouseup', () => { if (draggingSize) { draggingSize = false; this.tool._pushHistory(); } });

    const onWheel = (e) => {
      e.stopPropagation(); e.preventDefault();
      const next = stepTextSize(this.tool.currentSize, e.deltaY < 0 ? 1 : -1, e.shiftKey);
      setSize(next, true);
    };
    sizePop?.addEventListener('wheel', onWheel, { passive: false });
    btnSize?.addEventListener('wheel', onWheel, { passive: false });

    const styles = [
      { id: 'btnTextBold', prop: 'bold', key: 'currentBold' },
      { id: 'btnTextItalic', prop: 'italic', key: 'currentItalic' },
      { id: 'btnTextUnderline', prop: 'underline', key: 'currentUnderline' },
      { id: 'btnTextStrike', prop: 'strike', key: 'currentStrike' },
    ];
    styles.forEach(({ id, prop, key }) => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        const active = e.currentTarget.classList.toggle('active');
        this.tool[key] = active;
        this.tool.updateActiveItem({ [prop]: active }, true);
      });
    });

    document.querySelectorAll('.text-color-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = chip.getAttribute('data-color');
        document.querySelectorAll('.text-color-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const dot = document.getElementById('textColorDot');
        if (dot) dot.style.backgroundColor = color;
        this.tool.currentColor = color;
        this.tool.updateActiveItem({ color }, true);
        this.closeAllPopovers();
      });
    });
  }

  bindShadowControls() {
    const tog = document.getElementById('toggleTextShadow');
    tog?.addEventListener('change', () => {
      this.tool.currentShadow.enabled = tog.checked;
      this.tool.updateActiveItem({ shadow: { enabled: tog.checked } }, true);
    });

    const bindRange = (id, prop, unit, scale = 1) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        const val = parseFloat(el.value) * scale;
        this.tool.currentShadow[prop] = val;
        const b = document.getElementById(`${id}Val`);
        if (b) b.textContent = `${el.value}${unit}`;
        this.tool.updateActiveItem({ shadow: { [prop]: val } }, false);
      });
      el?.addEventListener('change', () => this.tool._pushHistory());
    };
    bindRange('sliderShadowBlur', 'blur', 'px');
    bindRange('sliderShadowOpacity', 'opacity', '%', 0.01);
    bindRange('sliderShadowOffset', 'offsetY', 'px');
  }

  bindBackgroundControls() {
    const tog = document.getElementById('toggleTextBg');
    tog?.addEventListener('change', () => {
      this.tool.currentBg.enabled = tog.checked;
      this.tool.updateActiveItem({ bg: { enabled: tog.checked } }, true);
    });

    document.querySelectorAll('.bg-color-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = chip.getAttribute('data-color');
        document.querySelectorAll('.bg-color-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.tool.currentBg.color = color;
        this.tool.updateActiveItem({ bg: { color } }, true);
      });
    });

    const bindBgRange = (id, prop, unit, scale = 1) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        const val = parseFloat(el.value) * scale;
        this.tool.currentBg[prop] = val;
        const b = document.getElementById(`${id}Val`);
        if (b) b.textContent = `${el.value}${unit}`;
        this.tool.updateActiveItem({ bg: { [prop]: val } }, false);
      });
      el?.addEventListener('change', () => this.tool._pushHistory());
    };
    bindBgRange('sliderBgRoundness', 'roundness', 'px');
    bindBgRange('sliderBgOpacity', 'opacity', '%', 0.01);
    bindBgRange('sliderBgBorder', 'borderSize', 'px');
  }

  bindHistoryAndActions() {
    document.getElementById('btnTextAdd')?.addEventListener('click', () => this.tool.addNewTextBox());
    document.getElementById('btnTextUndo')?.addEventListener('click', () => this.tool.undo());
    document.getElementById('btnTextRedo')?.addEventListener('click', () => this.tool.redo());
    document.getElementById('btnTextClear')?.addEventListener('click', () => {
      if (this.tool.activeItem) this.tool.deleteActiveItem();
    });
    document.getElementById('btnCancelText')?.addEventListener('click', () => this.actions.onCancel?.());
    document.getElementById('btnApplyText')?.addEventListener('click', () => this.actions.onApply?.());
  }

  updateSelectionState(item) {
    const isSelected = Boolean(item);
    this.container?.classList.toggle('has-no-selection', !isSelected);
    const del = document.getElementById('btnTextClear');
    if (del) {
      del.disabled = !isSelected;
      del.title = isSelected ? 'Delete Text (Del)' : 'No text selected';
    }
    if (isSelected) this.syncActiveToUI(item);
    else this.closeAllPopovers();
  }

  updateSliderUI(px) {
    const val = Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, Math.round(px || 36)));
    const pct = textSizeToSliderRatio(val);
    const fill = document.getElementById('textSizeFill'), thumb = document.getElementById('textSizeThumb'), badge = document.getElementById('textSizeBadge');
    if (fill) fill.style.height = `${pct * 100}%`;
    if (thumb) thumb.style.bottom = `${pct * 100}%`;
    if (badge) badge.textContent = `${val}px`;
    return val;
  }

  syncActiveToUI(item) {
    if (!item) return;
    for (const [id, val] of [['btnTextBold', item.bold], ['btnTextItalic', item.italic], ['btnTextUnderline', item.underline], ['btnTextStrike', item.strike]]) {
      document.getElementById(id)?.classList.toggle('active', Boolean(val));
    }
    const dot = document.getElementById('textColorDot');
    if (dot && item.color) dot.style.backgroundColor = item.color;
    const togS = document.getElementById('toggleTextShadow'); if (togS) togS.checked = Boolean(item.shadow?.enabled);
    const togB = document.getElementById('toggleTextBg'); if (togB) togB.checked = Boolean(item.bg?.enabled);
    if (item.size) { this.updateSliderUI(item.size); this.tool.currentSize = item.size; }
    const fontBadge = document.getElementById('textFontBadge');
    if (fontBadge && item.font) {
      const match = document.querySelector(`.text-font-option[data-font="${item.font}"]`);
      if (match) fontBadge.textContent = match.textContent;
    }
  }

  resetUI() {
    this.closeAllPopovers();
    const fontBadge = document.getElementById('textFontBadge');
    if (fontBadge) fontBadge.textContent = 'Inter';
    document.querySelectorAll('.text-font-option').forEach((o) => {
      o.classList.toggle('active', o.getAttribute('data-font') === 'Inter, sans-serif');
    });
    this.updateSliderUI(this.tool.currentSize);
    ['btnTextBold', 'btnTextItalic', 'btnTextUnderline', 'btnTextStrike'].forEach((id) => document.getElementById(id)?.classList.remove('active'));
    const dot = document.getElementById('textColorDot'); if (dot) dot.style.backgroundColor = '#ffffff';
    document.querySelectorAll('.text-color-chip').forEach((c) => c.classList.toggle('active', c.getAttribute('data-color') === '#ffffff'));
    const togS = document.getElementById('toggleTextShadow'); if (togS) togS.checked = false;
    const togB = document.getElementById('toggleTextBg'); if (togB) togB.checked = false;
    const setR = (id, val, u) => { const el = document.getElementById(id), b = document.getElementById(`${id}Val`); if (el) el.value = val; if (b) b.textContent = `${val}${u}`; };
    setR('sliderShadowBlur', 8, 'px'); setR('sliderShadowOpacity', 85, '%'); setR('sliderShadowOffset', 4, 'px');
    setR('sliderBgRoundness', 8, 'px'); setR('sliderBgOpacity', 85, '%'); setR('sliderBgBorder', 0, 'px');
    document.querySelectorAll('.bg-color-chip').forEach((c) => c.classList.toggle('active', c.getAttribute('data-color') === '#0e121b'));
    document.getElementById('tabBtnShadow')?.classList.add('active');
    document.getElementById('tabBtnBg')?.classList.remove('active');
    document.getElementById('panelTextShadow')?.classList.remove('hidden');
    document.getElementById('panelTextBg')?.classList.add('hidden');
    const u = document.getElementById('btnTextUndo'), r = document.getElementById('btnTextRedo');
    if (u) u.disabled = true; if (r) r.disabled = true;
  }
}
