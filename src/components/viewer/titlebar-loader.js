/**
 * Bukaake Titlebar Glowing Loading Beam Component
 * Controls the ambient glowing progress beam across the bottom of the titlebar
 * during background image decodes (Q key / full RAW).
 */

export class TitlebarLoader {
  constructor(beamId = 'titlebarLoadingBeam', titlebarId = 'appTitlebar') {
    this.beam = document.getElementById(beamId);
    this.titlebar = document.getElementById(titlebarId);
    this.resetTimer = null;
    this.isActive = false;
  }

  getBeam() {
    if (!this.beam || !document.body.contains(this.beam)) {
      this.beam = document.getElementById('titlebarLoadingBeam');
    }
    return this.beam;
  }

  getTitlebar() {
    if (!this.titlebar || !document.body.contains(this.titlebar)) {
      this.titlebar = document.getElementById('appTitlebar');
    }
    return this.titlebar;
  }

  start() {
    clearTimeout(this.resetTimer);
    const beam = this.getBeam();
    const titlebar = this.getTitlebar();
    this.isActive = true;

    if (beam) {
      beam.classList.remove('completed');
      beam.classList.add('loading');
    }
    if (titlebar) {
      titlebar.classList.add('is-loading');
    }
  }

  complete() {
    clearTimeout(this.resetTimer);
    const beam = this.getBeam();
    const titlebar = this.getTitlebar();

    if (beam && this.isActive) {
      beam.classList.remove('loading');
      beam.classList.add('completed');
    }

    this.isActive = false;
    this.resetTimer = setTimeout(() => {
      if (beam) {
        beam.classList.remove('completed', 'loading');
      }
      if (titlebar) {
        titlebar.classList.remove('is-loading');
      }
    }, 380);
  }

  cancel() {
    clearTimeout(this.resetTimer);
    this.isActive = false;
    const beam = this.getBeam();
    const titlebar = this.getTitlebar();

    if (beam) {
      beam.classList.remove('loading', 'completed');
    }
    if (titlebar) {
      titlebar.classList.remove('is-loading');
    }
  }
}

export const titlebarLoader = new TitlebarLoader();
