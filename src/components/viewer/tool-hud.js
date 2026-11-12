/**
 * Bukaake In-Tool Contextual Shortcut HUD Component
 * Displays non-closable, collapsible stroke-free glass shortcut guidance (< 210 lines).
 */

import { i18n } from '../../services/platform/i18n-service.js';

const STORAGE_KEY_COLLAPSED = 'bukaake-tool-hud-collapsed';

export class ToolHud {
  constructor(viewportContainer = null) {
    this.viewport = viewportContainer || document.getElementById('viewportContainer') || document.body;
    this.activeTool = null;
    this.isCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';

    this.container = null;
    this.cardEl = null;
    this.beaconWrapEl = null;

    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.id = 'toolHud';
    this.container.className = 'tool-hud-container hidden';
    this.viewport.appendChild(this.container);

    this.render();

    window.addEventListener('bukaake-language-changed', () => {
      if (this.activeTool) this.render();
    });
  }

  show(toolName) {
    if (!toolName) return;
    this.activeTool = toolName;
    this.render();
    this.container.classList.remove('hidden');
  }

  hide() {
    this.activeTool = null;
    this.container.classList.add('hidden');
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(this.isCollapsed));
    this.render();
  }

  getToolConfig(tool) {
    switch (tool) {
      case 'crop':
        return {
          title: i18n.t('toolHud.cropTitle', {}, 'Crop Shortcuts'),
          icon: 'ri-crop-line',
          iconClass: 'tool-crop',
          shortcuts: [
            { kbds: ['Shift', 'Drag'], label: i18n.t('toolHud.cropMagnet', {}, 'Center laser magnet') },
            { kbds: ['Wheel inside'], label: i18n.t('toolHud.cropZoom', {}, 'Zoom / pan in box') },
            { kbds: ['Drag Edges'], label: i18n.t('toolHud.cropResize', {}, 'Resize crop area') },
            { kbds: ['Drag Inside'], label: i18n.t('toolHud.cropMove', {}, 'Reposition crop area') },
            { kbds: ['Enter', '2× Click'], label: i18n.t('toolHud.cropApply', {}, 'Apply & save crop') },
            { kbds: ['Esc'], label: i18n.t('toolHud.cropCancel', {}, 'Cancel crop') },
          ],
        };
      case 'draw':
        return {
          title: i18n.t('toolHud.drawTitle', {}, 'Drawing Shortcuts'),
          icon: 'ri-mark-pen-line',
          iconClass: 'tool-draw',
          shortcuts: [
            { kbds: ['S'], label: i18n.t('toolHud.drawSmooth', {}, 'Cycle smooth mode') },
            { kbds: ['[', ']'], label: i18n.t('toolHud.drawSize', {}, 'Brush size down / up') },
            { kbds: ['Shift', 'Drag'], label: i18n.t('toolHud.drawHoriz', {}, 'Lock horizontal line') },
            { kbds: ['Ctrl', 'Drag'], label: i18n.t('toolHud.drawVert', {}, 'Lock vertical line') },
            { kbds: ['Ctrl', 'Z / Y'], label: i18n.t('toolHud.drawUndo', {}, 'Undo / Redo stroke') },
            { kbds: ['Enter', 'Esc'], label: i18n.t('toolHud.drawApply', {}, 'Apply / Discard') },
          ],
        };
      case 'text':
        return {
          title: i18n.t('toolHud.textTitle', {}, 'Typography Shortcuts'),
          icon: 'ri-text',
          iconClass: 'tool-text',
          shortcuts: [
            { kbds: ['Alt', 'T'], label: i18n.t('toolHud.textAdd', {}, 'Add new text box') },
            { kbds: ['2× Click'], label: i18n.t('toolHud.textEdit', {}, 'Edit text inline') },
            { kbds: ['Drag Handles'], label: i18n.t('toolHud.textScale', {}, 'Dynamic font scale') },
            { kbds: ['Delete'], label: i18n.t('toolHud.textDelete', {}, 'Delete active box') },
            { kbds: ['Ctrl', 'Z / Y'], label: i18n.t('toolHud.textUndo', {}, 'Undo / Redo text') },
            { kbds: ['Enter', 'Esc'], label: i18n.t('toolHud.textApply', {}, 'Apply / Deselect') },
          ],
        };
      case 'adjustments':
      case 'adjust':
        return {
          title: i18n.t('toolHud.adjustTitle', {}, 'Adjustments Shortcuts'),
          icon: 'ri-equalizer-line',
          iconClass: 'tool-adjust',
          shortcuts: [
            { kbds: ['Drag Sliders'], label: i18n.t('toolHud.adjustSliders', {}, 'Real-time color tuning') },
            { kbds: ['Preset Chips'], label: i18n.t('toolHud.adjustPresets', {}, 'Instant photo looks') },
            { kbds: ['Reset'], label: i18n.t('toolHud.adjustReset', {}, 'Restore original colors') },
            { kbds: ['Esc'], label: i18n.t('toolHud.adjustClose', {}, 'Close adjustments') },
          ],
        };
      default:
        return null;
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.container.classList.toggle('is-collapsed', this.isCollapsed);

    const config = this.getToolConfig(this.activeTool);
    if (!config) return;

    if (this.isCollapsed) {
      // ----------------------------------------------------------------------
      // Collapsed Compact Glowing '!' in Circle Outline Beacon
      // Stays anchored in corner (top: 20px, left: 20px) with zero background fill
      // ----------------------------------------------------------------------
      const wrap = document.createElement('div');
      wrap.className = 'tool-hud-beacon-wrap';
      wrap.title = `${config.title} (${i18n.t('toolHud.expandTip', {}, 'Click to expand shortcuts')})`;
      wrap.addEventListener('click', () => this.toggleCollapse());

      const icon = document.createElement('i');
      icon.className = 'ri-error-warning-line tool-hud-beacon-icon';
      wrap.appendChild(icon);

      const tooltip = document.createElement('span');
      tooltip.className = 'tool-hud-beacon-tooltip';
      tooltip.textContent = config.title;
      wrap.appendChild(tooltip);

      this.container.appendChild(wrap);
    } else {
      // ----------------------------------------------------------------------
      // Expanded HUD Card State (Non-closable, collapse button only)
      // ----------------------------------------------------------------------
      const card = document.createElement('div');
      card.className = 'tool-hud-card';

      // Header
      const header = document.createElement('div');
      header.className = 'tool-hud-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'tool-hud-title-wrap';

      const iconBox = document.createElement('div');
      iconBox.className = `tool-hud-icon-box ${config.iconClass}`;
      const icon = document.createElement('i');
      icon.className = config.icon;
      iconBox.appendChild(icon);

      const title = document.createElement('span');
      title.className = 'tool-hud-title';
      title.textContent = config.title;

      titleWrap.appendChild(iconBox);
      titleWrap.appendChild(title);
      header.appendChild(titleWrap);
      card.appendChild(header);

      // Rows
      const rowsContainer = document.createElement('div');
      rowsContainer.className = 'tool-hud-rows';

      config.shortcuts.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'tool-hud-row';

        const kbdsWrap = document.createElement('div');
        kbdsWrap.className = 'tool-hud-kbds';
        item.kbds.forEach((k) => {
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          kbdsWrap.appendChild(kbd);
        });

        const label = document.createElement('span');
        label.className = 'tool-hud-label';
        label.textContent = item.label;

        row.appendChild(kbdsWrap);
        row.appendChild(label);
        rowsContainer.appendChild(row);
      });

      card.appendChild(rowsContainer);

      // Dedicated Footer Collapse Action (No 'X' in header)
      const footer = document.createElement('div');
      footer.className = 'tool-hud-footer';

      const footerTip = document.createElement('span');
      footerTip.className = 'tool-hud-footer-tip';
      footerTip.textContent = i18n.t('toolHud.footerTip', {}, 'HUD Guide');

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'tool-hud-bottom-collapse-btn';
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCollapse();
      });

      const collapseLabel = document.createElement('span');
      collapseLabel.textContent = i18n.t('toolHud.collapse', {}, 'Collapse');
      collapseBtn.appendChild(collapseLabel);

      const collapseIcon = document.createElement('i');
      collapseIcon.className = 'ri-arrow-up-s-line';
      collapseBtn.appendChild(collapseIcon);

      footer.appendChild(footerTip);
      footer.appendChild(collapseBtn);
      card.appendChild(footer);

      this.container.appendChild(card);
    }
  }
}

