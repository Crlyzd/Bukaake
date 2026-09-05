/**
 * Bukaake Image Adjustment & Filter Preset Engine
 */

export class FilterEngine {
  constructor(canvasViewer) {
    this.viewer = canvasViewer;

    this.brightness = 100;
    this.contrast = 100;
    this.saturation = 100;
    this.hue = 0;
    this.blur = 0;
    this.invert = 0;

    this.activePreset = 'normal';
  }

  reset() {
    this.brightness = 100;
    this.contrast = 100;
    this.saturation = 100;
    this.hue = 0;
    this.blur = 0;
    this.invert = 0;
    this.activePreset = 'normal';

    this.apply();
  }

  setPreset(presetName) {
    this.activePreset = presetName;
    switch (presetName) {
      case 'vivid':
        this.brightness = 105;
        this.contrast = 125;
        this.saturation = 145;
        this.hue = 0;
        this.blur = 0;
        this.invert = 0;
        break;
      case 'cyberpunk':
        this.brightness = 110;
        this.contrast = 135;
        this.saturation = 160;
        this.hue = 300;
        this.blur = 0;
        this.invert = 0;
        break;
      case 'vintage':
        this.brightness = 95;
        this.contrast = 90;
        this.saturation = 80;
        this.hue = 25;
        this.blur = 0;
        this.invert = 0;
        break;
      case 'noir':
        this.brightness = 100;
        this.contrast = 140;
        this.saturation = 0;
        this.hue = 0;
        this.blur = 0;
        this.invert = 0;
        break;
      case 'highcontrast':
        this.brightness = 115;
        this.contrast = 160;
        this.saturation = 130;
        this.hue = 0;
        this.blur = 0;
        this.invert = 0;
        break;
      case 'normal':
      default:
        this.reset();
        return;
    }

    this.apply();
  }

  getFilterCssString() {
    return `brightness(${this.brightness}%) contrast(${this.contrast}%) saturate(${this.saturation}%) hue-rotate(${this.hue}deg) blur(${this.blur}px) invert(${this.invert}%)`;
  }

  apply() {
    this.viewer.render(this.getFilterCssString());
  }
}
