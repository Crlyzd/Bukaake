/**
 * Bukaake Floating Recording Dock Component
 * Stroke-free frosted glass recording widget with live timer and controls (< 160 lines)
 */

export class RecordingDock {
  constructor(containerEl = null) {
    this.container = containerEl || document.body;
    this.dock = null;
    this.timerEl = null;
    this.btnPause = null;
    this.btnStop = null;
    this.btnCancel = null;
    this.dotEl = null;

    this.onPause = null;
    this.onResume = null;
    this.onStop = null;
    this.onCancel = null;

    this.isPaused = false;
    this.createDom();
  }

  createDom() {
    this.dock = document.createElement('div');
    this.dock.className = 'recording-dock glass-panel hidden';
    this.dock.innerHTML = `
      <div class="recording-indicator" data-tauri-drag-region>
        <span class="recording-pulse-dot" data-tauri-drag-region></span>
        <span class="recording-timer" id="recordingTimer" data-tauri-drag-region>00:00</span>
      </div>
      <div class="recording-dock-divider"></div>
      <div class="recording-controls">
        <button class="recording-btn" id="btnRecPause" title="Pause Recording">
          <i class="ri-pause-line"></i>
        </button>
        <button class="recording-btn" id="btnRecMic" title="Mute Microphone">
          <i class="ri-mic-line"></i>
        </button>
        <button class="recording-btn stop" id="btnRecStop" title="Stop & Save Recording">
          <i class="ri-stop-fill"></i>
          <span>Done</span>
        </button>
        <button class="recording-btn cancel" id="btnRecCancel" title="Discard Recording (Esc)">
          <i class="ri-close-line"></i>
        </button>
      </div>
    `;

    this.timerEl = this.dock.querySelector('#recordingTimer');
    this.btnPause = this.dock.querySelector('#btnRecPause');
    this.btnMic = this.dock.querySelector('#btnRecMic');
    this.btnStop = this.dock.querySelector('#btnRecStop');
    this.btnCancel = this.dock.querySelector('#btnRecCancel');
    this.dotEl = this.dock.querySelector('.recording-pulse-dot');
    this.isMicMuted = false;

    this.container.appendChild(this.dock);
    this.bindEvents();
  }

  bindEvents() {
    [this.btnPause, this.btnMic, this.btnStop, this.btnCancel].forEach((btn) => {
      btn?.addEventListener('mousedown', (e) => e.stopPropagation());
    });
    this.btnPause?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isPaused) {
        this.setPaused(false);
        this.onResume?.();
      } else {
        this.setPaused(true);
        this.onPause?.();
      }
    });

    this.btnMic?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setMicMuted(!this.isMicMuted);
      this.onToggleMic?.(this.isMicMuted);
    });

    this.btnStop?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
      this.onStop?.();
    });

    this.btnCancel?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
      this.onCancel?.();
    });
  }

  show(options = {}) {
    this.onPause = options.onPause || null;
    this.onResume = options.onResume || null;
    this.onStop = options.onStop || null;
    this.onCancel = options.onCancel || null;
    this.onToggleMic = options.onToggleMic || null;

    this.setPaused(false);
    this.setMicMuted(false);
    if (options.hasMic) {
      this.btnMic?.classList.remove('hidden');
    } else {
      this.btnMic?.classList.add('hidden');
    }

    this.updateTimer('00:00');
    this.dock.classList.remove('hidden');
    this.dock.classList.add('dock-enter');
    setTimeout(() => this.dock.classList.remove('dock-enter'), 300);
  }

  updateTimer(timeStr) {
    if (this.timerEl) {
      this.timerEl.textContent = timeStr;
    }
  }

  setPaused(paused) {
    this.isPaused = paused;
    if (paused) {
      this.dotEl?.classList.add('paused');
      this.btnPause.innerHTML = '<i class="ri-play-line"></i>';
      this.btnPause.title = 'Resume Recording';
    } else {
      this.dotEl?.classList.remove('paused');
      this.btnPause.innerHTML = '<i class="ri-pause-line"></i>';
      this.btnPause.title = 'Pause Recording';
    }
  }

  setMicMuted(muted) {
    this.isMicMuted = muted;
    if (!this.btnMic) return;
    if (muted) {
      this.btnMic.classList.add('muted');
      this.btnMic.innerHTML = '<i class="ri-mic-off-line"></i>';
      this.btnMic.title = 'Unmute Microphone';
    } else {
      this.btnMic.classList.remove('muted');
      this.btnMic.innerHTML = '<i class="ri-mic-line"></i>';
      this.btnMic.title = 'Mute Microphone';
    }
  }

  hide() {
    this.dock.classList.add('hidden');
    this.isPaused = false;
    this.isMicMuted = false;
  }
}
