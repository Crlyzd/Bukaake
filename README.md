<div align="center">

  <h1>Bukaake</h1>

  <p>
    <strong>The ultra-fast, transparent, and distraction-free photo viewer for Windows.</strong><br />
    <em>Reviving the desktop-immersive magic of the classic Google Picasa Photo Viewer with modern stroke-free frosted glass.</em>
  </p>

  <p>
    <a href="https://github.com/Crlyzd/Bukaake/releases/latest"><img src="https://img.shields.io/github/v/release/Crlyzd/Bukaake?color=00e5ff&label=Release&style=flat-square" alt="Latest Release" /></a>
    <a href="https://bukaake.kaleksananbagus.com"><img src="https://img.shields.io/badge/Website-bukaake.kaleksananbagus.com-00e5ff?style=flat-square&logo=googlechrome&logoColor=white" alt="Official Website" /></a>
    <a href="https://github.com/Crlyzd/Bukaake/releases"><img src="https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-0078d4?style=flat-square&logo=windows&logoColor=white" alt="Platform" /></a>
    <a href="https://github.com/Crlyzd/Bukaake/releases"><img src="https://img.shields.io/badge/Architecture-x64%20%7C%20ARM64-6c5ce7?style=flat-square" alt="Architecture" /></a>
    <a href="https://apps.microsoft.com/detail/9N964R72X9JS"><img src="https://img.shields.io/badge/Microsoft%20Store-MSIX%20Package-0078d4?style=flat-square&logo=microsoft&logoColor=white" alt="Microsoft Store" /></a>
    <a href="https://github.com/Crlyzd/Bukaake/releases"><img src="https://img.shields.io/badge/Edition-Single%20Portable%20Exe%20(~5MB)-00b894?style=flat-square" alt="Edition" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-0984e3?style=flat-square" alt="License" /></a>
  </p>

  <p>
    <a href="https://apps.microsoft.com/detail/9N964R72X9JS"><img src="https://img.shields.io/badge/%F0%9F%8F%AA_Get_it_from-Microsoft_Store-0078d4?style=for-the-badge&logo=microsoft&logoColor=white" alt="Get it from Microsoft Store" /></a>
    <a href="https://github.com/Crlyzd/Bukaake/releases/latest"><img src="https://img.shields.io/badge/%E2%AC%87%EF%B8%8F_Download_Latest-Windows_x64-00e5ff?style=for-the-badge&logoColor=black" alt="Download Latest x64" /></a>
    <a href="https://github.com/Crlyzd/Bukaake/releases/latest"><img src="https://img.shields.io/badge/%E2%AC%87%EF%B8%8F_Download_ARM64-Surface_%2F_Snapdragon-2d3436?style=for-the-badge&logoColor=white" alt="Download Latest ARM64" /></a>
  </p>

  <br />

  <img width="1280" alt="Bukaake Photo Viewer Showcase" src="https://github.com/user-attachments/assets/6626a09e-23c3-41d3-8796-6fe82474fb0d" style="border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.4);" />

  <p align="center">
    <em>Pure transparent desktop immersion: softly dimmed wallpaper background, centered floating controls, and zero bulky borders.</em>
  </p>

</div>

<br />

---

## 💡 Why Bukaake?

Most photo viewers on Windows today are slow to launch, cluttered with heavy toolbars, or trap your pictures inside thick, distracting window frames. Some even force you to pay for extra codecs just to open photos from your iPhone!

**Bukaake** revives what made **Google Picasa Photo Viewer** so beloved, supercharged with modern Windows 10 & 11 design:

- 🪟 **Zero Distractions**: Truly borderless and translucent. Your desktop wallpaper stays softly dimmed in the background while your photo takes center stage.
- ⚡ **Auto-Hiding Controls**: Relax and enjoy your photos in peace. The second your mouse stops moving, all buttons and titles gently fade away.
- 🚀 **Instant Launch**: Opens in the blink of an eye and uses almost no RAM. A single ~5 MB portable file—no installation needed.
- 🖱️ **Smooth Navigation**: Zoom like butter with your mouse wheel right into the fine details, click-and-drag to pan, and flip effortlessly through folders with your arrow keys.
- ✍️ **Vector Typography & Markup**: Add scalable text overlays with 8-point handles, dynamic shadows, rounded fills, pen, and highlighter without external editors.
- 🗑️ **Stress-Free & Safe**: Send bad photos straight to your **Windows Recycle Bin** with `Delete`—easily restore them if you ever change your mind!
- 📸 **Built-in Snip & Record**: Take instant screenshots of any monitor or region, or record video clips with crisp audio right from the app.

<br />

---

## ⚡ Highlights at a Glance

| Superpower | Why It Matters |
| :--- | :--- |
| 🪟 **Desktop-Immersive Transparency** | Translucent dimmed background lets your desktop show through without heavy borders. |
| 🖼️ **Native Desktop Wallpaper** | One-click Win32 wallpaper setting with automatic PNG caching and format transcoding. |
| ⚡ **Sub-10ms Launch & Standby** | Instant tray daemon with automatic memory trimming down to ~8–15 MB RAM. |
| 📷 **49+ Formats & Camera RAW** | Native iPhone HEIC/HEIF (100% free), 24+ RAW camera formats, and 3D VFX textures. |
| ✍️ **Vector Typography & Crop** | Vector text engine with 8-point handles, dynamic shadows, laser-guided crop, pen & highlighter. |
| 📸 **Integrated Screen Snipper** | Multi-monitor crosshair capture with instant clipboard copy and auto-saved PNGs. |
| 🎥 **Hardware GPU Screen Recording** | Direct3D 11 & WGC zero-copy VRAM capture (<2% CPU) with 60 FPS / Space Saver modes & hardware H.264 MP4. |
| 🏪 **Microsoft Store & Portable** | Distribute as a zero-install ~5MB portable executable or install via Microsoft Store Desktop Bridge MSIX. |
| 🗑️ **Safe Recycle Bin Deletion** | Win32 Recycle Bin integration (`Delete` to trash, `Shift+Delete` to shred). |
| 🎨 **Stroke-Free Frosted Glass** | Dual theme engine: Deep Obsidian Dark Mode & Frosted Slate Light Mode. |

<br />

---

## ✨ Feature Deep Dive

### 🪟 1. Picasa-Style Transparent Immersion
When you open any picture, Bukaake softly dims your surrounding desktop wallpaper with zero blur artifacts, giving your photo center stage without boxing it inside an opaque window frame.
- **75% Viewport Ceiling**: Images comfortably fill up to 75% of your screen so your desktop remains visible.
- **Elevated Control Dock**: Floating toolbars stay elevated safely above your Windows taskbar.
- **Auto-Hiding Controls**: Move your mouse to bring up controls; stay idle for 2.5 seconds and all chrome fades smoothly to 0% opacity.
- **Interactive Return-to-Start**: Hover over the titlebar app icon in Mode 1 to reveal a back arrow, cleanly closing the image and resetting/centering window bounds back to start.
- **1-Click Desktop Wallpaper**: Set any photo, cropped composition, or edited canvas directly as your Windows desktop wallpaper via native Win32 APIs, with automatic PNG caching for non-standard formats to prevent grey desktop glitches.

<p align="center">
  <img width="1280" alt="Transparent Immersion" src="https://github.com/user-attachments/assets/c29df440-32b0-49dd-b3d6-a25a9567b370" style="border-radius: 10px;" />
</p>

---

### 📷 2. Comprehensive Format Engine & Camera RAW
Bukaake natively opens **49 image formats** with zero external dependencies, codecs, or paid Microsoft Store extensions.

```
• Everyday Web     : PNG, JPG, JPEG, WebP, GIF, SVG, BMP, ICO, TIFF, AVIF
• Apple Ecosystem  : HEIC, HEIF, HIF, HEIFS, HEICS (Fully hardware-accelerated, free)
• Camera RAW       : ARW, CR2, CR3, NEF, NRW, DNG, RAF, RW2, ORF, PEF, SRF, SR2
• 3D & VFX Art     : OpenEXR (.exr), Radiance HDR (.hdr), DDS, TGA, QOI, PNM, PPM, PGM
```

- **Instant Embedded Previews**: Camera RAW files open instantly (~15ms) from high-speed embedded previews.
- **Full Sensor RAW Develop (`Q`)**: Press **`Q`** or click the sensor icon to unpack full uncompressed sensor Bayer data with unclipped dynamic range. Powered by a **zero-base64 binary streaming pipeline** and **off-thread browser rasterization (`img.decode()`)** with a dual-theme **ambient glowing loading beam** across the titlebar.
- **EXIF Telemetry Drawer (`I`)**: Press **`I`** anytime to inspect detailed camera telemetry: camera body, lens model, focal length, aperture ($f$-stop), shutter speed, ISO, and GPS location.
- **5-Slot Predictive Prefetch**: Photos in your current folder pre-load silently in the background for zero-latency arrow navigation.

---

### 📸 3. Screen Snipping & Desktop Recording
Capture and share anything on your screen without launching heavy third-party software.

<table width="100%">
<tr>
<td width="50%" valign="top">

#### 📸 Precision Screen Snipper & OCR
- **Capture Modes**: Snip your Full Screen, Active Display, or drag any Custom Region.
- **Native Screen OCR**: Extract text from any on-screen region instantly using native hardware-accelerated `Windows.Media.Ocr`. Spatial geometry analysis preserves line wraps, stanza breaks, and paragraph indents.
- **Loupe Color Eyedropper**: Zoom into details with a 9x9 magnified pixel grid to inspect and copy exact HEX and RGB color values in one click.
- **Smart Alignment**: Live coordinate crosshairs and dimension badges.
- **Direct Clipboard Delivery**: Automatically copies snips or OCR text to your clipboard (`CF_DIB` / Unicode text) for instant pasting (`Ctrl+V`).
- **Timestamped Auto-Save**: Clean PNG files automatically save to your `Pictures/Screenshots` folder.

</td>
<td width="50%" valign="top">

#### 🎥 Hardware GPU Screen Recorder
- **Zero-Copy VRAM Pipeline**: Desktop frames capture directly into Direct3D 11 GPU textures via `Windows.Graphics.Capture` with sub-2% CPU overhead and zero RAM round-trips.
- **Hardware H.264 & AAC MP4**: Streams hardware-accelerated `.mp4` video directly through Windows Media Foundation `IMFSinkWriter` with instant finalization.
- **Sample-Accurate Audio**: Mixes WASAPI system loopback and microphone inputs at 48kHz stereo with a contiguous sample-accurate clock—zero drift or lag.
- **Space Saver Mode & Sync Calibration**: Toggle ~75% storage savings with optimized 30 FPS profiles, or capture silky 60 FPS video. Calibrate audio sync with a ±200ms stepper in Settings.
- **Dedicated Overlay Window**: Isolated transparent window (`snipper.html`) hosts crosshairs, selection bounds, and recording pills with zero desktop redraw flash.
- **Clean Borderless Capture**: Windows 11 default yellow capture border is completely suppressed.

</td>
</tr>
<tr>
<td>
  <img width="600" alt="Screen Snipping" src="https://github.com/user-attachments/assets/500290d7-a62d-4d9c-a766-b937177567aa" style="border-radius: 8px;" />
</td>
<td>
  <img width="600" alt="Screen Recording" src="https://github.com/user-attachments/assets/e4821226-86e9-4300-b231-969b4eb377da" style="border-radius: 8px;" />
</td>
</tr>
</table>

---

### ✍️ 4. Vector Typography, Markup & Precision Crop
Quickly add text captions, mark up screenshots, or adjust composition with built-in creative tools:
- **Precision Typography Engine (`T`)**: Add rich, draggable vector text with **center-anchored scaling** and 8-point handles. Features font sizes up to **600px** with quadratic precision, scroll-wheel sizing, unified tabbed popovers for soft shadows and rounded background fills, and **magnetic laser guides** for flush center and edge snapping.
- **Freehand Pen & Highlighter (`D`)**: Draw sharp annotations or mark lines with translucent ink. Features curated palettes, stroke thickness sliders, and multi-step **Undo (`Ctrl+Z`)** and **Redo (`Ctrl+Y`)**.
- **Laser-Guided Crop (`C`)**: Standard aspect presets (1:1, 16:9, 9:16, 4:3, Freeform) featuring dynamic magnetic guides that snap directly to image centers and edges.
- **Universal Enter-to-Commit**: Press **`Enter`** to immediately apply and commit changes across Text, Crop, and Drawing tools.
- **Real-Time Color Filters (`E`)**: Adjust Brightness, Contrast, Saturation, Exposure, and Temperature on-the-fly with 60 FPS GPU-accelerated rendering.
- **[Alitken](https://github.com/Crlyzd/Alitken-GUI) & [Cathet](https://github.com/Crlyzd/Cathet) Companion Bridges**: One-click workflow to transfer photos to [Alitken](https://github.com/Crlyzd/Alitken-GUI) for advanced image editing, or hand off OCR extracted text directly into [Cathet](https://github.com/Crlyzd/Cathet) for instant editing.

<p align="center">
  <img width="800" alt="Drawing and Crop Tools" src="https://github.com/user-attachments/assets/846ec474-a1e3-440e-9c35-ac00fe7116cb" style="border-radius: 10px;" />
</p>

---

### 🎨 5. Stroke-Free Dual Theme Engine
Designed from the ground up for modern Windows aesthetics:
- **Zero-Stroke Policy**: No ugly 1px border outlines or lines on windows, buttons, or floating bars. Depth is created purely through frosted glass fills and multi-layered ambient drop shadows.
- **Deep Obsidian Dark Mode**: True deep obsidian dark (`rgba(6, 7, 10, 0.92)`).
- **Soft Slate Light Mode**: Elegant daytime palette eliminating harsh pure-black borders in favor of soft obsidian slate (`#242938`).

<p align="center">
  <img width="1280" alt="Dual Themes" src="https://github.com/user-attachments/assets/5ec39b3a-28b5-468b-86e9-73beeb451728" style="border-radius: 10px;" />
</p>

---

### ⚡ 6. Native Windows Performance & Portability
- **Sub-10ms Launch via Tray Standby**: Keeps Bukaake pre-warmed in your notification tray. Double-clicking any image opens instantaneously.
- **Windows 11 DWM 1px Border Elimination**: Seamless frameless geometry achieved by preserving native `WS_THICKFRAME`, retaining rounded corners, drop shadows, and acrylic transparency without white outline artifacts or window resize flash.
- **Win32 Subclassing & Smooth Maximize**: Subclasses `WM_NCHITTEST` and `SC_SIZE` to prevent edge-click jump on dialogs, and intercepts titlebar double-clicks (`WM_NCLBUTTONDBLCLK` / `SC_MAXIMIZE`) to smoothly transition into Mode 2 transparent fullscreen without DWM maximize flash.
- **Automatic Memory Trimming**: Uses Win32 working-set trimming to shrink idle background memory down to ~8–15 MB RAM.
- **Multi-Monitor Position Memory**: Restores to your preferred monitor and window coordinates without annoying screen-jumping.
- **1-Click Shell Association**: Make Bukaake your default photo viewer for 49 formats under `HKCU` without annoying UAC permission prompts.
- **True Portability**: A single standalone executable. Move `bukaake.exe` to a USB drive or secondary SSD—file associations self-heal automatically on launch.
- **Microsoft Store & Desktop Bridge (MSIX)**: Native runtime channel detection via Win32 `GetCurrentPackageFamilyNameW`, declarative file associations, automatic Store background updates, and zero registry modifications.
- **Built-In Self-Updater**: Background GitHub Releases checks with in-place executable updates via `self-replace`.

<br />

---

## ⌨️ Keyboard Shortcuts

<table width="100%">
<tr>
<th width="33%">🧭 Navigation & Zoom</th>
<th width="33%">🎨 Creative Tools</th>
<th width="33%">⚙️ Window & System</th>
</tr>
<tr>
<td valign="top">

| Key | Action |
| :--- | :--- |
| `Left` / `Right` | Previous / Next photo |
| `Up` / `Down` | Zoom In / Zoom Out (Picasa) |
| `Mouse Wheel` | Zoom anchored to cursor |
| `Middle Click` | Pan image canvas |
| `F` | Fit image to window |
| `1` | 100% actual size (1:1) |
| `,` / `.` (or `L`/`R`) | Rotate 90° Left / Right |
| `B` | Toggle background checkerboard |
| `P` | Toggle pixel art crisp mode |

</td>
<td valign="top">

| Key | Action |
| :--- | :--- |
| **`T`** | **Toggle Typography & Text Tool** |
| `D` | Toggle Pen & Highlighter |
| `C` | Toggle Precision Crop |
| `E` | Toggle Color Adjustments |
| `H` / `V` | Flip Horizontal / Vertical |
| `Q` | Full Sensor RAW Develop |
| `I` | Toggle EXIF Info Drawer |
| **`Enter`** | **Apply & commit active tool** |
| `Ctrl + Z` | Undo action / stroke |
| `Ctrl + Y` / `Ctrl+Shift+Z` | Redo action / stroke |

</td>
<td valign="top">

| Key | Action |
| :--- | :--- |
| `?` | Keyboard shortcuts cheat sheet |
| `Ctrl + O` | Open image file |
| `Ctrl + S` | Save / Export active image |
| `Ctrl + C` | Copy image to clipboard |
| `Ctrl + V` | Paste image from clipboard |
| `Alt+Shift+S` / `PrtScn` | Capture / Record Screen |
| `Delete` | Move to Recycle Bin (safe) |
| `Shift + Del` | Permanently delete |
| `F11` / `Enter` | Toggle Fullscreen Mode |
| `Esc` | Cancel tool / Close / Standby |

</td>
</tr>
</table>

<br />

---

## 💻 System Requirements

| Component | Minimum Requirement | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 (64-bit, Version 19041+) | Windows 11 (64-bit, Version 22H2 or newer) |
| **Processor (CPU)** | Intel Core i3 / AMD Ryzen 3 / ARM64 | Intel Core i5 / AMD Ryzen 5 / Snapdragon X Elite |
| **Graphics (GPU)** | DirectX 11 capable GPU (Direct3D 11 & WGC) | Dedicated GPU or modern integrated graphics |
| **System Memory (RAM)** | 512 MB (~8–15 MB background standby) | 2 GB+ (for high-resolution Camera RAW sequences) |
| **Storage / Runtime** | ~10 MB free disk space | Single standalone portable `.exe` (~5 MB) |
| **Dependencies** | None. Zero external codecs, DLLs, or runtimes required. |

<br />

---

## 🚀 Quick Start

### 🏪 Option A: Microsoft Store (MSIX)
Install directly from the **[Microsoft Store](https://apps.microsoft.com/detail/9N964R72X9JS)** *(Listing ID: `9N964R72X9JS`)* for seamless automatic background updates, sandboxed reliability, and declarative Windows default app handling.

### ⚡ Option B: Standalone Portable Binary (~5 MB)
1. Download the latest binary from the **[Releases Page](https://github.com/Crlyzd/Bukaake/releases/latest)**:
   - For standard 64-bit PCs: `bukaake-vX.Y.Z-x64.exe`
   - For ARM devices (Surface Pro, Snapdragon X): `bukaake-vX.Y.Z-arm64.exe`
2. **Run the file directly.** No installer, no registry bloat, no administrative privileges required.
3. Click the **Settings** (gear icon) in the toolbar and select **Register Associations** to set Bukaake as your default viewer.

<br />

---

## 🛠️ Building From Source

Prerequisites: **Node.js 18+**, **Rust (stable)**, and the **C++ Build Tools for Windows**.

```powershell
# 1. Clone the repository
git clone https://github.com/Crlyzd/Bukaake.git
cd Bukaake

# 2. Install frontend dependencies
npm install

# 3. Launch with interactive Control Center
.\run.ps1
# or run with standard dev command:
npm run tauri:dev
```

<details>
<summary><b>View Developer Scripts & Build Commands</b></summary>

<br />

- `npm run dev` — Run local Vite dev server on `http://localhost:3000`.
- `npm run tauri:dev` — Launch Tauri v2 desktop application with live reload.
- `npm run build` — Production bundle validation for frontend assets.
- `cargo check --manifest-path src-tauri/Cargo.toml` — Fast backend type-check.
- `npm run bump` — Atomically synchronize versions across `package.json`, `Cargo.toml`, and `tauri.conf.json`.
- `.\run.ps1` (Option `[7]`) — Interactive Microsoft Store MSIX packaging and multi-architecture bundling.
- `powershell scripts/package-msix.ps1` — Automated MSIX Desktop Bridge staging, manifest templating, and bundle packaging.
- `powershell scripts/generate-store-assets.ps1` — Synthesize high-DPI Windows Store visual assets from `icon.png`.

</details>

<br />

---

## 💖 About the Creator & Support

Bukaake is designed and developed with ❤️ by **[Kaleksanan Bagus](https://kaleksananbagus.com)**.

If you love using Bukaake and want to support independent, high-performance desktop software:

<p>
  <a href="https://saweria.co/curlyzed" target="_blank"><img src="https://img.shields.io/badge/%E2%98%95_Saweria-Support_on_Saweria-fa8231?style=for-the-badge&logoColor=white" alt="Support on Saweria" /></a>
  <a href="https://paypal.me/BagusMassani" target="_blank"><img src="https://img.shields.io/badge/%F0%9F%92%B3_PayPal-Donate_via_PayPal-003087?style=for-the-badge&logo=paypal&logoColor=white" alt="Donate with PayPal" /></a>
</p>

- 🌐 **Official Website**: [bukaake.kaleksananbagus.com](https://bukaake.kaleksananbagus.com)
- 🌐 **Creator Portfolio**: [kaleksananbagus.com](https://kaleksananbagus.com)
- 🎨 **Companion Editor**: [Crlyzd/Alitken-GUI](https://github.com/Crlyzd/Alitken-GUI)
- 🐛 **Report a Bug or Suggest a Feature**: [Feedback Form](https://docs.google.com/forms/d/e/1FAIpQLSciTFA6rWYPq98UwqOvJgLnqGh5P71Vcz5d2GPVdne9Tz34WA/viewform) or open an [Issue](https://github.com/Crlyzd/Bukaake/issues).

<br />

---

## 🙏 Acknowledgements & Open-Source Credits

Bukaake is built on top of an incredible ecosystem of open-source projects, high-performance libraries, and Windows platform technologies:

### ⚡ Core Engine & Runtime
- **[Tauri v2](https://github.com/tauri-apps/tauri)** — Next-generation, memory-efficient desktop application framework.
- **[windows-rs](https://github.com/microsoft/windows-rs)** — Native Microsoft Win32 and WinRT bindings for Direct3D 11, WGC, OCR, and Media Foundation.
- **[window-vibrancy](https://github.com/tauri-apps/window-vibrancy)** — Native Windows Acrylic composition effects.
- **[self-replace](https://github.com/mitsuhiko/self-replace)** — Safe in-place binary executable replacement for self-updating.
- **[rfd](https://github.com/PolyMeilex/rfd)** — Native Rusty file dialogs.

### 📷 Imaging & Media Pipelines
- **[LibRaw](https://www.libraw.org/)** — Industry-standard camera RAW unpacking and Bayer demosaicing engine.
- **[image-rs](https://github.com/image-rs/image)** — Fast native image format encoding and decoding.
- **[heif-oxide](https://github.com/oxipng/heif-oxide)** — Pure Rust ISO/IEC 23008-12 ISOBMFF container parser for HEIC/HEIF photos.
- **[kamadak-exif](https://github.com/kamadak-exif/exif-rs)** — Comprehensive camera metadata and EXIF extraction.
- **[cpal](https://github.com/RustAudio/cpal)** — Cross-platform audio library powering WASAPI loopback and microphone capture.
- **[arboard](https://github.com/1Password/arboard)** — Native Win32 clipboard integration (`CF_DIB` / `CF_HDROP`).

### 🎨 Typography & Design System
- **[Inter](https://rsms.me/inter/)** by Rasmus Andersson — Modern, crisp user interface typography.
- **[JetBrains Mono](https://www.jetbrains.com/lp/mono/)** by JetBrains — High-contrast monospace font for camera specs and EXIF telemetry.
- **[Remix Icon](https://remixicon.com/)** by Remix Design — Minimalist, neutral monochrome SVG iconography.

<br />

---

## 📄 License

Bukaake is open-source software licensed under the **[GPL-3.0 License](LICENSE)**.  
Distributed without warranty in the hope of bringing back fluid, beautiful, and distraction-free viewing to the Windows desktop.

