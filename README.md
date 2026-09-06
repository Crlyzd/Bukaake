# 🌸 Bukaake

> **The ultra-fast, transparent, and distraction-free photo viewer for Windows.**  
> Bringing back the fluid, desktop-immersive magic of the classic **Google Picasa Photo Viewer** with modern stroke-free frosted glass.

[![Latest Release](https://img.shields.io/github/v/release/Crlyzd/Bukaake?color=00f0ff&label=Download%20Latest&style=flat-square)](https://github.com/Crlyzd/Bukaake/releases/latest)
[![Windows](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-0078d4?style=flat-square&logo=windows)](https://github.com/Crlyzd/Bukaake/releases)
[![Portable](https://img.shields.io/badge/Edition-Single%20Executable%20(Portable)-success?style=flat-square)](https://github.com/Crlyzd/Bukaake/releases)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=flat-square)](LICENSE)

---

<!-- HERO SCREENSHOT PLACEHOLDER -->
<div align="center">
  <img width="2559" height="1440" alt="image" src="https://github.com/user-attachments/assets/6626a09e-23c3-41d3-8796-6fe82474fb0d" />
  <p><em>Desktop-immersive viewing: Dimmed wallpaper background, centered floating titlebar, and zero window borders.</em></p>
</div>

---

## 💡 Why Bukaake?

Most modern image viewers are either bloated, slow to start up, or trap your photos inside heavy window frames with thick borders and distracting menus.

**Bukaake** revives the beloved viewing experience of the legendary **Google Picasa Photo Viewer**:
- **Zero Distractions**: Borderless and translucent. Your desktop wallpaper stays visible softly dimmed in the background.
- **Auto-Fading UI**: Look at your photo in pure peace. The moment your mouse stops moving, all toolbar buttons and titles fade away into complete transparency.
- **Lightning Fast**: Launches in milliseconds and uses almost no RAM. A single ~5 MB portable file that doesn't need to be installed.
- **Butter-Smooth Navigation**: Zoom smoothly right into details with your mouse wheel, pan effortlessly, and tap Left/Right arrows to flip through your photo album.

---

## ✨ Features You'll Love

### 🪟 1. Picasa-Style Transparent Immersion
When you open an image, Bukaake lets your desktop wallpaper shine through with gentle dimming and zero blur. The photo floats elegantly at a comfortable 75% screen scale so it never overpowers your workspace.

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/c29df440-32b0-49dd-b3d6-a25a9567b370">

---

### ✍️ 2. Freehand Pen & Highlighter
Need to circle a detail, highlight a line on a receipt, or jot a quick note?
- Tap **`D`** to open the drawing toolbar.
- Choose between a crisp **Pen** or a soft translucent **Highlighter**.
- Pick curated vibrant colors and stroke thicknesses with an interactive cursor preview ring.
- Full **Undo (`Ctrl+Z`)** and **Redo (`Ctrl+Y`)** support.

<img width="787" height="442" alt="Cropped Image_edited" src="https://github.com/user-attachments/assets/846ec474-a1e3-440e-9c35-ac00fe7116cb" />

---

### ✂️ 3. Quick Crop & Instant Color Adjustments
- **Crop (`C`)**: Quickly frame your shot with popular aspect ratios (1:1 Square, 16:9 Widescreen, 4:3, or Freeform) with smooth corner handles.
- **Enhance (`E`)**: Fine-tune Brightness, Contrast, Saturation, Exposure, and Warmth with real-time sliders or one-click preset styles.
- **Safe Editing**: Unsaved changes are automatically tracked so you never accidentally lose your work when switching photos.

<img width="1892" height="1065" alt="image" src="https://github.com/user-attachments/assets/ff3deac8-318a-43b0-8b37-29205394a73b" />
<img width="1681" height="948" alt="image" src="https://github.com/user-attachments/assets/b5e28977-d018-4b7c-aaa5-c1f35bce8315" />

---

### 🎨 4. Stroke-Free Frosted Glass (Dark & Light)
Designed specifically for Windows 10 and 11:
- Ultra-modern frosted acrylic with soft ambient drop shadows and zero harsh border lines.
- **Deep Obsidian Dark Mode** for late-night viewing and **Clean Frosted Slate Light Mode** for daylight.
- Seamless one-click theme toggle.

<img width="2559" height="1440" alt="image" src="https://github.com/user-attachments/assets/5ec39b3a-28b5-468b-86e9-73beeb451728" />

---

### 🛡️ 5. 1-Click Windows Default App & Path Auto-Healing
Set Bukaake as your primary Windows photo viewer in a single click:
- **37 Format Registrations**: Effortlessly associates standard formats, Apple HEIC/HEIF containers, camera RAWs, and HDR/VFX textures with Windows.
- **Windows Explorer Context Menu**: Adds a handy *"Open with Bukaake"* right-click entry for fast access.
- **Silent Path Auto-Healing**: Bukaake is 100% portable. If you move `bukaake.exe` to another folder, it automatically detects the change on launch and silently updates your shell paths in the background—your file associations never break.
- **Easy Switcher**: Manage it anytime from Settings (`Ctrl+,`) with a single merged toggle (`Register` / `Unregister`).

---

### 📷 6. 37+ Formats, Instant Camera RAW, HEIC & EXIF Telemetry
More than just standard photos:
- **Apple & Mobile HEIC/HEIF**: Native decoding for `.heic`, `.heif`, `.hif`, `.heifs`, and `.heics` files using hardware-accelerated Windows Imaging Component (WIC) and container extraction—zero third-party codecs or Windows Store extensions needed.
- **Camera RAW Previews**: Instant ~15ms full-resolution previews for Sony (`.arw`, `.srf`, `.sr2`), Canon (`.cr2`, `.cr3`), Nikon (`.nef`, `.nrw`), Adobe/DJI (`.dng`), Fujifilm (`.raf`), Panasonic Lumix (`.rw2`), Olympus (`.orf`), and Pentax (`.pef`).
- **Game & VFX Textures**: Native decoding for HDR (`.hdr`), OpenEXR (`.exr`), DirectDraw Surface (`.dds`), Truevision Targa (`.tga`), Netpbm (`.pnm`, `.ppm`, `.pgm`, `.pbm`), and QOI (`.qoi`).
- **Asymmetric 5-Slot Prefetch Cache**: 60 FPS zero-latency photo flipping with smart directional preloading (+3 forward / +1 backward) and bounded LRU eviction.
- **Hardware Telemetry (`I`)**: Deep EXIF inspection revealing camera make/model, lens, aperture ($f$-stop), shutter speed, ISO, focal length, and precision GPS coordinates.

---

### 🔄 7. Effortless In-App Self-Updating
Never worry about missing new features or manually downloading new builds:
- **Background Checks**: Quietly checks GitHub releases on launch (and stays completely disabled in Fullscreen Mode for distraction-free viewing).
- **One-Click Native Update**: Click **Install** in the Settings window to stream the update with a real-time glowing progress bar.
- **In-Place Seamless Relaunch**: Bukaake replaces its own executable in-place without breaking your taskbar pins, desktop shortcuts, or file associations, and relaunches into the new version instantly.

---

## ⚡ Quick Start (No Installation Needed!)

1. Go to the **[Latest Release](https://github.com/Crlyzd/Bukaake/releases/latest)** page.
2. Download the latest executable matching your architecture (e.g., **`bukaake-vX.Y.Z-x64.exe`** or **`arm64.exe`** for ARM laptops like Surface Pro).
3. **Double-click to run!** That's it—no setup wizard, no extra dependencies, and no administrative rights required.
4. Open **Settings** (`Ctrl+,`) and click **Register** to make Bukaake your default photo viewer across all 37 image formats in seconds!

---

## ⌨️ Everyday Keyboard Shortcuts

| Shortcut | What It Does |
| :---: | :--- |
| **`Left` / `Right`** | Previous / Next photo in current folder |
| **`Mouse Wheel`** | Smooth zoom in / out (anchored to cursor) |
| **`F`** | Fit image to window / screen |
| **`1`** | View at 100% (1:1 actual pixels) |
| **`,` / `.`** | Rotate Left / Right (90°) |
| **`D`** | Toggle Freehand Drawing & Highlighting |
| **`C`** | Toggle Crop tool |
| **`E`** | Toggle Color Adjustments & Filters |
| **`I`** | Toggle Image Info & EXIF Drawer |
| **`Ctrl` + `S`** | Save edited image |
| **`Ctrl` + `Shift` + `S`** | Save As new image file |
| **`Ctrl` + `C`** | Copy processed image directly to clipboard |
| **`Ctrl` + `Z` / `Ctrl` + `Y`** | Undo / Redo drawing strokes |
| **`Esc`** | Exit fullscreen mode or close window |

---

## 🛠️ For Developers & Builders

Want to run from source or build your own portable executable?

```bash
# 1. Clone the repository
git clone https://github.com/Crlyzd/Bukaake.git
cd Bukaake

# 2. Run the interactive Control Center (Windows)
.\run.ps1
# or double-click run.bat
```

The built-in Control Center provides an interactive 10-option manager:
- **Live Development**: Native desktop window (`npm run tauri:dev`) or instant web dev server (`npm run dev`).
- **Fast Multi-Core Builds**: Option `[3]` compiles an incremental `bukaake-vX.Y.Z-x64-fast.exe` with uncapped CPU threads and zero LTO bottleneck.
- **Production Builds**: Options `[4]` and `[5]` produce maximum-compression, symbol-stripped binaries for x64 and ARM64.
- **One-Key Version Bumping**: Syncs versions atomically across `package.json`, `Cargo.toml`, and `tauri.conf.json`.

---

## 📄 License

Bukaake is open source under the **[GPL-3.0 License](LICENSE)**.
