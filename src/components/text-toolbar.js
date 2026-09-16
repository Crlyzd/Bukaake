/**
 * Bukaake Floating Glass Text Sub-Toolbar Component
 * Coordinates font, size, styles (B/I/U/S), Canva-style Shadow & Background popovers (< 260 lines).
 */

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
    this.bindShadowControls();
    this.bindBackgroundControls();
    this.bindHistoryAndActions();

    this.tool.onHistoryChange = ({ canUndo, canRedo }) => {
      const u = document.getElementById('btnTextUndo'), r = document.getElementById('btnTextRedo');
      if (u) u.disabled = !canUndo;
      if (r) r.disabled = !canRedo;
    };

    this.tool.onActiveChange = (item) => {
      if (item) this.syncActiveToUI(item);
    };
  }

  bindPopovers() {
    const triggers = [
      { btn: 'btnTextFontPop', pop: 'textFontPopover' },
      { btn: 'btnTextSizePop', pop: 'textSizePopover' },
      { btn: 'btnTextColorPop', pop: 'textColorPopover' },
      { btn: 'btnTextShadowPop', pop: 'textShadowPopover' },
      { btn: 'btnTextBgPop', pop: 'textBgPopover' },
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

  closeAllPopovers() {
    document.querySelectorAll('.text-popover').forEach((p) => p.classList.add('hidden'));
    document.querySelectorAll('#textToolbar .text-pill-btn').forEach((b) => b.classList.remove('active'));
  }

  bindTypographyControls() {
    document.querySelectorAll('.text-font-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const font = opt.getAttribute('data-font');
        const label = opt.textContent;
        document.querySelectorAll('.text-font-option').forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');
        const badge = document.getElementById('textFontBadge');
        if (badge) badge.textContent = label;
        this.tool.currentFont = font;
        if (this.tool.activeItem) {
          this.tool.activeItem.font = font;
          this.tool.renderOverlayInput(this.tool.activeItem);
        }
        this.closeAllPopovers();
      });
    });

    const sizeTrack = document.getElementById('textSizeTrack'), sizeFill = document.getElementById('textSizeFill');
    const sizeThumb = document.getElementById('textSizeThumb'), sizeBadge = document.getElementById('textSizeBadge');

    const setSize = (px) => {
      const val = Math.min(140, Math.max(14, px));
      const pct = (val - 14) / (140 - 14);
      if (sizeFill) sizeFill.style.height = `${pct * 100}%`;
      if (sizeThumb) sizeThumb.style.bottom = `${pct * 100}%`;
      if (sizeBadge) sizeBadge.textContent = `${val}px`;
      this.tool.currentSize = val;
      if (this.tool.activeItem) {
        this.tool.activeItem.size = Math.round(val / (this.tool.viewer.scale || 1));
        this.tool.renderOverlayInput(this.tool.activeItem);
      }
    };
    setSize(36);

    let draggingSize = false;
    const onTrack = (e) => {
      if (!sizeTrack) return;
      const rect = sizeTrack.getBoundingClientRect();
      const r = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
      setSize(Math.round(14 + r * (140 - 14)));
    };
    sizeTrack?.addEventListener('mousedown', (e) => { e.stopPropagation(); draggingSize = true; onTrack(e); });
    window.addEventListener('mousemove', (e) => { if (draggingSize) onTrack(e); });
    window.addEventListener('mouseup', () => { draggingSize = false; });

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
        if (this.tool.activeItem) {
          this.tool.activeItem[prop] = active;
          this.tool.renderOverlayInput(this.tool.activeItem);
        }
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
        if (this.tool.activeItem) {
          this.tool.activeItem.color = color;
          this.tool.renderOverlayInput(this.tool.activeItem);
        }
        this.closeAllPopovers();
      });
    });
  }

  bindShadowControls() {
    const tog = document.getElementById('toggleTextShadow');
    tog?.addEventListener('change', () => {
      this.tool.currentShadow.enabled = tog.checked;
      if (this.tool.activeItem) {
        this.tool.activeItem.shadow.enabled = tog.checked;
        this.tool.renderOverlayInput(this.tool.activeItem);
      }
    });

    const bindRange = (id, prop, unit, scale = 1) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        const val = parseFloat(el.value) * scale;
        this.tool.currentShadow[prop] = val;
        const b = document.getElementById(`${id}Val`);
        if (b) b.textContent = `${el.value}${unit}`;
        if (this.tool.activeItem) {
          this.tool.activeItem.shadow[prop] = val;
          this.tool.renderOverlayInput(this.tool.activeItem);
        }
      });
    };
    bindRange('sliderShadowBlur', 'blur', 'px');
    bindRange('sliderShadowOpacity', 'opacity', '%', 0.01);
    bindRange('sliderShadowOffset', 'offsetY', 'px');
  }

  bindBackgroundControls() {
    const tog = document.getElementById('toggleTextBg');
    tog?.addEventListener('change', () => {
      this.tool.currentBg.enabled = tog.checked;
      if (this.tool.activeItem) {
        this.tool.activeItem.bg.enabled = tog.checked;
        this.tool.renderOverlayInput(this.tool.activeItem);
      }
    });

    document.querySelectorAll('.bg-color-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = chip.getAttribute('data-color');
        document.querySelectorAll('.bg-color-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.tool.currentBg.color = color;
        if (this.tool.activeItem) {
          this.tool.activeItem.bg.color = color;
          this.tool.renderOverlayInput(this.tool.activeItem);
        }
      });
    });

    const bindBgRange = (id, prop, unit, scale = 1) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        const val = parseFloat(el.value) * scale;
        this.tool.currentBg[prop] = val;
        const b = document.getElementById(`${id}Val`);
        if (b) b.textContent = `${el.value}${unit}`;
        if (this.tool.activeItem) {
          this.tool.activeItem.bg[prop] = val;
          this.tool.renderOverlayInput(this.tool.activeItem);
        }
      });
    };
    bindBgRange('sliderBgRoundness', 'roundness', 'px');
    bindBgRange('sliderBgOpacity', 'opacity', '%', 0.01);
    bindBgRange('sliderBgBorder', 'borderSize', 'px');
  }

  bindHistoryAndActions() {
    document.getElementById('btnTextUndo')?.addEventListener('click', () => this.tool.undo());
    document.getElementById('btnTextRedo')?.addEventListener('click', () => this.tool.redo());
    document.getElementById('btnTextClear')?.addEventListener('click', () => this.tool.clear());
    document.getElementById('btnCancelText')?.addEventListener('click', () => this.actions.onCancel?.());
    document.getElementById('btnApplyText')?.addEventListener('click', () => this.actions.onApply?.());
  }

  syncActiveToUI(item) {
    if (!item) return;
    document.getElementById('btnTextBold')?.classList.toggle('active', Boolean(item.bold));
    document.getElementById('btnTextItalic')?.classList.toggle('active', Boolean(item.italic));
    document.getElementById('btnTextUnderline')?.classList.toggle('active', Boolean(item.underline));
    document.getElementById('btnTextStrike')?.classList.toggle('active', Boolean(item.strike));
    const dot = document.getElementById('textColorDot');
    if (dot && item.color) dot.style.backgroundColor = item.color;
    const togS = document.getElementById('toggleTextShadow');
    if (togS) togS.checked = Boolean(item.shadow?.enabled);
    const togB = document.getElementById('toggleTextBg');
    if (togB) togB.checked = Boolean(item.bg?.enabled);
  }
}
