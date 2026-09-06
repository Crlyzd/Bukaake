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
  <img src="docs/screenshots/hero_viewer_preview.png" alt="Bukaake Transparent Photo Viewer Preview" width="880" />
  <p><em>Desktop-immersive viewing: Dimmed wallpaper background, centered floating titlebar, and zero window borders.</em></p>
</div>

---

## 💡 Why Bukaake?

Most modern image viewers are either bloated, slow to start up, or trap your photos inside heavy window frames with thick borders and distracting menus.

**Bukaake** revives the beloved viewing experience of the legendary **Google Picasa Photo Viewer**:
- **Zero Distractions**: Borderless and translucent. Your desktop wallpaper stays visible softly dimmed in the background.
- **Auto-Fading UI**: Look at your photo in pure peace. The moment your mouse stops moving, all toolbar buttons and titles fade away into complete transparency.
- **Lightning Fast**: Launches in milliseconds and uses almost no RAM. A single ~4.7 MB portable file that doesn't need to be installed.
- **Butter-Smooth Navigation**: Zoom smoothly right into details with your mouse wheel, pan effortlessly, and tap Left/Right arrows to flip through your photo album.

---

## ✨ Features You'll Love

### 🪟 1. Picasa-Style Transparent Immersion
When you open an image, Bukaake lets your desktop wallpaper shine through with gentle dimming and zero blur. The photo floats elegantly at a comfortable 75% screen scale so it never overpowers your workspace.

```
[ 📸 SCREENSHOT PLACEHOLDER: Transparent Fullscreen Mode with dim desktop background ]
Suggested file: docs/screenshots/feature_transparent_mode.png
```

---

### ✍️ 2. Freehand Pen & Highlighter
Need to circle a detail, highlight a line on a receipt, or jot a quick note?
- Tap **`D`** to open the drawing toolbar.
- Choose between a crisp **Pen** or a soft translucent **Highlighter**.
- Pick curated vibrant colors and stroke thicknesses with an interactive cursor preview ring.
- Full **Undo (`Ctrl+Z`)** and **Redo (`Ctrl+Y`)** support.

```
[ 📸 SCREENSHOT PLACEHOLDER: Freehand Pen & Highlighter popover drawing over photo ]
Suggested file: docs/screenshots/feature_drawing_tool.png
```

---

### ✂️ 3. Quick Crop & Instant Color Adjustments
- **Crop (`C`)**: Quickly frame your shot with popular aspect ratios (1:1 Square, 16:9 Widescreen, 4:3, or Freeform) with smooth corner handles.
- **Enhance (`E`)**: Fine-tune Brightness, Contrast, Saturation, Exposure, and Warmth with real-time sliders or one-click preset styles.
- **Safe Editing**: Unsaved changes are automatically tracked so you never accidentally lose your work when switching photos.

```
[ 📸 SCREENSHOT PLACEHOLDER: Crop handles & glass adjustment slider panel ]
Suggested file: docs/screenshots/feature_crop_adjustments.png
```

---

### 🎨 4. Stroke-Free Frosted Glass (Dark & Light)
Designed specifically for Windows 10 and 11:
- Ultra-modern frosted acrylic with soft ambient drop shadows and zero harsh border lines.
- **Deep Obsidian Dark Mode** for late-night viewing and **Clean Frosted Slate Light Mode** for daylight.
- Seamless one-click theme toggle.

```
[ 📸 SCREENSHOT PLACEHOLDER: Side-by-side Dark Obsidian vs Light Frosted theme ]
Suggested file: docs/screenshots/feature_dual_themes.png
```

---

### 🔄 5. Effortless Auto-Updates
Never worry about missing new features. Bukaake automatically checks for GitHub releases quietly in the background (and stays completely silent while you're enjoying fullscreen viewing).

---

## ⚡ Quick Start (No Installation Needed!)

1. Go to the **[Latest Release](https://github.com/Crlyzd/Bukaake/releases/latest)** page.
2. Download **`bukaake-v0.1.0-x64.exe`** (or `arm64.exe` for ARM laptops like Surface Pro).
3. **Double-click to run!** That's it—no setup wizard, no extra dependencies, and no administrative rights required.

> **Tip**: Right-click any photo (`.jpg`, `.png`, `.webp`, `.avif`, `.gif`), select **Open with...**, and choose **Bukaake** (check *"Always use this app"* to make it your permanent default photo viewer).

---

## ⌨️ Everyday Keyboard Shortcuts

| Shortcut | What It Does |
| :---: | :--- |
| **`Left` / `Right`** | Previous / Next photo in current folder |
| **`Mouse Wheel`** | Smooth zoom in / out (anchored to cursor) |
| **`F`** | Fit image to window / screen |
| **`1`** | View at 100% (1:1 actual pixels) |
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

The built-in Control Center handles live development with hot reload, one-key version bumping, and ultra-compact compilation.

---

## 📄 License

Bukaake is open source under the **[GPL-3.0 License](LICENSE)**.