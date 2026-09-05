/**
 * Bukaake Adjustments Panel Component
 * Color sliders, preset chips, and filter resetting
 */

export class AdjustmentsPanel {
  constructor(options = {}) {
    this.container = document.getElementById('adjustmentsPanel');
    this.filters = options.filters;
    this.onFilterChange = options.onFilterChange || null;
    this.onClose = options.onClose || null;

    this.init();
  }

  init() {
    this.setupSliders();
    this.setupPresets();
    this.setupCloseAndReset();
  }

  setupSliders() {
    this.bindSlider('sliderBrightness', 'valBrightness', '%', (v) => {
      this.filters.brightness = v;
      this.filters.apply();
      this.onFilterChange?.();
    });

    this.bindSlider('sliderContrast', 'valContrast', '%', (v) => {
      this.filters.contrast = v;
      this.filters.apply();
      this.onFilterChange?.();
    });

    this.bindSlider('sliderSaturation', 'valSaturation', '%', (v) => {
      this.filters.saturation = v;
      this.filters.apply();
      this.onFilterChange?.();
    });

    this.bindSlider('sliderHue', 'valHue', '°', (v) => {
      this.filters.hue = v;
      this.filters.apply();
      this.onFilterChange?.();
    });

    this.bindSlider('sliderBlur', 'valBlur', 'px', (v) => {
      this.filters.blur = v;
      this.filters.apply();
      this.onFilterChange?.();
    });

    this.bindSlider('sliderInvert', 'valInvert', '%', (v) => {
      this.filters.invert = v;
      this.filters.apply();
      this.onFilterChange?.();
    });
  }

  bindSlider(id, valId, unit, callback) {
    const slider = document.getElementById(id);
    const valSpan = document.getElementById(valId);
    slider?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (valSpan) valSpan.textContent = `${val}${unit}`;
      callback(parseFloat(val));
    });
  }

  setupPresets() {
    document.querySelectorAll('.preset-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
        e.target.classList.add('active');
        const preset = e.target.getAttribute('data-preset');
        this.filters.setPreset(preset);
        this.syncSliderUI();
        this.onFilterChange?.();
      });
    });
  }

  setupCloseAndReset() {
    document.getElementById('btnCloseAdjustments')?.addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });

    document.getElementById('btnResetFilters')?.addEventListener('click', () => {
      this.filters.reset();
      this.syncSliderUI();
      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
      document.querySelector('.preset-chip[data-preset="normal"]')?.classList.add('active');
      this.onFilterChange?.();
    });
  }

  syncSliderUI() {
    this.updateSliderValue('sliderBrightness', 'valBrightness', `${this.filters.brightness}%`, this.filters.brightness);
    this.updateSliderValue('sliderContrast', 'valContrast', `${this.filters.contrast}%`, this.filters.contrast);
    this.updateSliderValue('sliderSaturation', 'valSaturation', `${this.filters.saturation}%`, this.filters.saturation);
    this.updateSliderValue('sliderHue', 'valHue', `${this.filters.hue}°`, this.filters.hue);
    this.updateSliderValue('sliderBlur', 'valBlur', `${this.filters.blur}px`, this.filters.blur);
    this.updateSliderValue('sliderInvert', 'valInvert', `${this.filters.invert}%`, this.filters.invert);
  }

  updateSliderValue(sliderId, labelId, text, value) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (slider) slider.value = value;
    if (label) label.textContent = text;
  }

  toggle() {
    if (this.container) {
      const isHidden = this.container.classList.toggle('hidden');
      return !isHidden;
    }
    return false;
  }

  show() {
    this.container?.classList.remove('hidden');
  }

  hide() {
    this.container?.classList.add('hidden');
  }

  isOpen() {
    return this.container && !this.container.classList.contains('hidden');
  }
}
