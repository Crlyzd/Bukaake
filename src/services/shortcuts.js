/**
 * Bukaake Keyboard Shortcuts Registry
 * Centralizes hotkeys and dispatches viewer/toolbar actions
 */

export class ShortcutsRegistry {
  constructor(actions = {}) {
    this.actions = actions;
    this.init();
  }

  setActions(actions) {
    this.actions = { ...this.actions, ...actions };
  }

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  handleKeyDown(e) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        this.actions.onOpenFile?.();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.actions.onSaveImage?.();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.actions.onDrawUndo?.();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.actions.onCopyImage?.();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        this.actions.onPasteClipboard?.();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.actions.onNavigateBatch?.(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.actions.onNavigateBatch?.(1);
        break;
      case '+':
      case '=':
        e.preventDefault();
        this.actions.onZoomIn?.();
        break;
      case '-':
      case '_':
        e.preventDefault();
        this.actions.onZoomOut?.();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        this.actions.onFitScreen?.();
        break;
      case '1':
        e.preventDefault();
        this.actions.onActualSize?.();
        break;
      case ',':
      case '<':
      case 'l':
      case 'L':
        e.preventDefault();
        this.actions.onRotateLeft?.();
        break;
      case '.':
      case '>':
      case 'r':
      case 'R':
        e.preventDefault();
        this.actions.onRotateRight?.();
        break;
      case 'h':
      case 'H':
        e.preventDefault();
        this.actions.onFlipH?.();
        break;
      case 'v':
      case 'V':
        e.preventDefault();
        this.actions.onFlipV?.();
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        this.actions.onToggleCrop?.();
        break;
      case 'd':
      case 'D':
        e.preventDefault();
        this.actions.onToggleDraw?.();
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        this.actions.onToggleAdjustments?.();
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        this.actions.onToggleMetadata?.();
        break;
      case 'b':
      case 'B':
        e.preventDefault();
        this.actions.onToggleBgMode?.();
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        this.actions.onTogglePixelated?.();
        break;
      case 'q':
      case 'Q':
        e.preventDefault();
        this.actions.onLoadFullRaw?.();
        break;
      case 'Enter':
      case 'F11':
        e.preventDefault();
        this.actions.onToggleMaximize?.();
        break;
      case 'Escape':
        e.preventDefault();
        this.actions.onEscape?.();
        break;
      case 'Delete':
        e.preventDefault();
        this.actions.onDeleteFile?.(Boolean(e.shiftKey));
        break;
      case '?':
        e.preventDefault();
        this.actions.onToggleHelp?.();
        break;
    }
  }
}
