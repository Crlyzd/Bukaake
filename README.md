# Bukaake

A high-performance, lightweight, and portable Windows image viewer built with Rust, Tauri v2, and modern Vanilla Web technologies, reviving the beloved, fluid, and desktop-immersive experience of the classic **Google Picasa Photo Viewer**.

## ✨ Features

- **Picasa-Style Borderless Viewing**: Transparent borderless window with native Windows acrylic/mica blur and idle cursor fade.
- **Glassmorphism Design System**: Modern frosted glass styling with subtle specular borders and elevation.
- **Dual Theme Engine**: Seamless dark and light themes with pure neutral monochrome styling.
- **High-Performance Canvas Viewer**: 60 FPS HTML5 canvas pan and zoom, anchored wheel zoom, fit-to-screen, and 1:1 view.
- **Image Adjustments & Cropper**: Real-time filters (brightness, contrast, saturation, exposure, warmth, vignette) and crop presets.
- **Settings & Update Support**: Built-in settings modal with updater integration, release check, and diagnostics.

## 🛠️ Tech Stack

- **Desktop Framework**: Tauri v2
- **Backend Language**: Rust
- **Windows Vibrancy**: `window-vibrancy` (Acrylic blur)
- **Frontend Core**: Vanilla JavaScript (ES6+ Modules) & HTML5 Canvas
- **Styling**: Vanilla CSS (Custom properties design system)
- **Bundler**: Vite

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)

### Development
```bash
# Install dependencies
npm install

# Run Vite web development server
npm run dev

# Run Tauri desktop app in dev mode
npm run tauri:dev
```

### Build
```bash
# Compile frontend bundle
npm run build

# Build standalone Windows desktop application
npm run tauri:build
```

## 📄 License
GPL-3.0