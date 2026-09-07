# Bukaake — Project Agent Guidelines & Architecture Manual

> **Bukaake**: A high-performance, lightweight, and portable Windows image viewer built with Rust, Tauri v2, and modern Vanilla Web technologies, reviving the beloved, fluid, and desktop-immersive experience of the classic **Google Picasa Photo Viewer**.

---

## 1. Core Architectural Pillars

Every agent (Architect, Coding Specialist, Code Reviewer, Orchestrator) working on this repository **MUST** strictly adhere to and enforce these five non-negotiable architectural pillars:

### Pillar 1: Modern Stroke-Free Glassmorphism Design System
All visual components must follow a cohesive, ultra-sleek, stroke-free frosted glass aesthetic:
- **Materials**: Use `backdrop-filter: blur(20px) saturate(180%)` with translucent RGBA/HSLA background fills.
- **Zero Lines / Strokes Policy**: **Never use 1px border strokes, lines, or specular highlight outlines** on windows, floating toolbars, buttons, cards, popovers, or dialogs. Visual boundary and depth are created exclusively through translucent frosted glass fills and soft, multi-layered ambient drop shadows (`box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5)`).
- **Zero Browser Focus Rings / Outlines Policy**: Never allow default browser focus rings to appear. All interactive elements (buttons, inputs, sliders, chips) MUST declare `outline: none !important;` on `:focus` and `:focus-visible` to prevent WebKit/Blink from drawing jarring black/blue rectangular outlines over frosted glass.
- **Card & Overlay Optical Isolation**: Floating dynamic menus, popovers (drawing options), context menus, and dialog cards (confirmation modal, shortcuts, settings) rendered over user imagery must use high-opacity dark obsidian backing (`rgba(14, 18, 27, 0.92)`) and deep ambient shadows (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55)`) to guarantee crystal-clear legibility and optical isolation over bright or busy images.
- **Single-Toast Notification Lifecycle**: Notification toasts must never stack vertically. The toast manager maintains a single active toast instance, cancelling pending dismiss timers and replacing content seamlessly with smooth entry/exit animations.
- **Seamless Spacing Dividers**: Never use solid 1px divider lines or strokes between button groups; use transparent spacing margins (`width: 5px; background: transparent;`).
- **Controls**: Floating pill toolbars, rounded glass cards (`border-radius: 8px` to `9999px`), frameless titlebar ghost buttons, and smooth micro-interactions (spring hover scale, active depression).
- **Typography & Icons**: Inter for UI, JetBrains Mono for metadata/coordinates. All UI icons **MUST** be **minimalist monochrome SVGs** or Remix Icons (`ri-*`) that inherit `currentColor` to adapt dynamically across dark and light glass themes; never use multi-colored, bitmap, or raster icons. **Zero Emojis Policy**: Never use colorful system/Unicode emojis (e.g., ❤️, ☕, 🚀) or raw text arrow symbols (e.g., ↗) in UI markup or component templates; always use crisp monochrome vector SVG icons.
- **Zero Monolithic / Plain Components**: Never use unstyled browser defaults or flat, opaque gray boxes for buttons, dropdowns, inputs, or toolbars.

### Pillar 2: Dual Theme Engine (Dark & Light)
The application must provide first-class support for both Dark and Light themes:
- **Design Tokens**: All styling must strictly utilize CSS custom properties defined in the design token system:
  - `--glass-bg`: Frosted background fill (Deep obsidian `rgba(6, 7, 10, 0.92)` in dark vs `rgba(255, 255, 255, 0.65)` in light).
  - `--glass-border`: Set to `transparent` (zero stroke lines).
  - `--glass-panel-bg`: Surface fill for window and panels (`rgba(2, 3, 5, calc(0.68 + var(--window-opacity) * 0.32))` in dark vs `rgba(244, 246, 249, ...)` in light).
  - `--text-main`, `--text-muted`, `--text-dim`: High-contrast accessible text colors.
  - `--action-bg`, `--action-text`: Action button fills.
- **Deep Obsidian Dark Mode**: Dark mode must be deeply dark, never washed-out blue or gray.
- **Zero Pure Black in Light Mode Policy**: **Never use pure pitch black (`#000000`, `#0a0a0a`, `#111111`, or raw `rgba(0, 0, 0, ...)`) in Light Mode** across any UI elements (action button fills, active preset chips, slider thumbs, text, icons, borders, or shadows). All dark accents, active buttons, slider thumbs, and primary text in Light Mode MUST use the refined dark obsidian slate tone derived from the Dark Mode setting card (`#242938` / `#2a3142`, with translucent alphas anchored to `rgba(26, 32, 44, ...)`). This ensures controls and typography remain modern, soft, and cohesive without harsh inky contrast.
- **Subtle Row Dividers in Light Mode**: Inner panel list dividers (e.g. metadata drawer rows, adjustments panel sections) in Light Mode use ultra-subtle slate tint `rgba(26, 32, 44, 0.08)` rather than dark lines or invisible borders.
- **Streamlined Dual Canvas Background Modes**: The canvas strictly provides two clean display states:
  1. *Pure Crystal Transparency* (desktop wallpaper or window acrylic shows directly through transparent canvas).
  2. *Deep Obsidian Slate Checkerboard* (universal inline vector SVG pattern with `#161922` base and `#252a38` 10px squares, resolution-independent and DPI-crisp). Solid dark/light opaque fills are excluded.
- **No Hardcoded Hex Colors**: Hardcoded color literals in component CSS or inline styles are prohibited.
- **Native Acrylic Tint Coordination**: The Rust backend applies native Windows Acrylic blur in coordination with the active theme (`Some((16, 19, 28, 248))` for dark, `Some((245, 247, 250, 140))` for light).
- **Theme Switching**: Instant, flicker-free theme switching with persistence in local storage and automatic system preference detection (`prefers-color-scheme`).

### Pillar 3: GitHub Releases Auto-Updater & Native Self-Updating
The application provides seamless background checks and native in-place self-updating via GitHub Releases:
- **Updater Architecture (`src/services/updater-service.js`, `src-tauri/src/updater.rs`)**: Powered by GitHub Releases API (`https://api.github.com/repos/Crlyzd/Bukaake/releases/latest`) with semver comparison and asset detection (x64 and arm64 binaries).
- **Native In-Place Self-Updating**: Clicking "Install vX.Y.Z" triggers `download_and_install_update` in Rust. It downloads the update matching the system architecture using `curl.exe` (with PowerShell fallback), emits live progress percentage (`bukaake-update-progress`), replaces the running executable in-place via `self-replace` without breaking shortcuts or pinned links, relaunches the updated executable, and terminates the old process cleanly.
- **Visual Progress Bar Track**: Update cards feature an embedded stroke-free rounded track with an animated glowing gradient fill (`#6366f1` to `#a855f7` to `#06b6d4`), displaying live download percentages and restarting status.
- **Startup Artifact Cleanup**: Cleanly purges any lingering `.old` or `.tmp` binary artifacts from past updates on application startup.
- **Multi-Window State Synchronization**: Broadcasts update state across main and settings windows via `localStorage` storage events, `bukaake-update-state` Tauri events, and custom DOM events.
- **Strict Immersion Invariant (Mode 2 Fullscreen Exclusion)**: In Fullscreen Image Viewer Mode (`body.mode-viewer`), launch checks are completely skipped for instant, distraction-free viewing.
- **Smooth Launch Performance (Mode 1)**: In Regular App Mode, background check is delayed by 1.5s after launch to keep startup at 60 FPS.
- **Rate-Limit Mitigation**: Manual checks triggered on settings open enforce a 1-hour cooldown if an update was recently checked, with interactive fallback to open GitHub releases in browser.

### Pillar 4: Dual-Mode & Picasa-Style Transparent Viewing
Reliving the iconic Google Picasa Photo Viewer experience with two tailored modes:
- **Mode 1: Regular App Mode (`body.mode-regular`)**:
  - Centered aspect-ratio window with docked frameless titlebar and native Windows acrylic blur.
  - Smooth window resizing with proportional aspect fitting and transparent edge handles.
- **Mode 2: Fullscreen Image Viewer Mode (`body.mode-viewer`)**:
  - **Strictly transparent with 75% brightness and NO blur**: Windows Acrylic blur is cleared via `clear_acrylic(&main_win)` and CSS blur is removed (`backdrop-filter: brightness(0.75)` + `background: rgba(0, 0, 0, 0.30)`). The desktop wallpaper remains visible behind the image without harsh/distracting blur.
  - **CRITICAL IMMERSION INVARIANT — Never Alter Mode 2**: Fullscreen Image Viewer Mode (`body.mode-viewer`) MUST ALWAYS remain strictly transparent with lowered brightness (75%) and zero blur. Any changes to tokens, frosted glass, card styles, window acrylic, or settings windows MUST NEVER introduce blur, opacity, or borders to Mode 2.
  - **Centered Ghost Titlebar Pill**: In Mode 2, the titlebar is centered at the top (`left: 50% !important; transform: translateX(-50%) !important; max-width: 85vw`), rendering as a floating pure-text overlay with deep ambient text-shadows (`0 1px 2px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.85)`).
  - **Fullscreen 75% Scale Ceiling**: When an image is loaded or fit in Mode 2 (`calculateFitScale`), the image occupies at most **75%** of available viewport width and height (`canvas.width * 0.75`, `canvas.height * 0.75`). This ensures the image does not dominate the entire screen, preserving surrounding desktop wallpaper immersion.
  - **Elevated Fullscreen Floating Toolbar**: In Mode 2, the floating control dock is elevated to `bottom: 80px !important;` so it never collides with or hovers over the Windows 10/11 taskbar.
  - **Taskbar-Aware Idle Hover Threshold**: The mouse inactivity controller monitors a `140px` bottom zone; moving the cursor near the taskbar or elevated toolbar keeps controls visible.
  - **Canvas Background Disabled in Fullscreen**: Background checkerboard toggling (`#btnBgMode`) is disabled and dimmed (`opacity: 0.28`, `cursor: default`) in Mode 2 to keep fullscreen strictly transparent.
  - **Contextual Titlebar Controls**: Titlebar buttons requiring an active image (such as Image Info `#btnToggleInfo` and shortcut `I`) are disabled when no image is loaded.
  - **Global Context Menu Suppression**: Default browser right-click context menus are suppressed across both windows (`window.addEventListener('contextmenu', e => e.preventDefault())`) to maintain a native desktop application experience.
  - Borderless maximization over the desktop (`decorations: false`, `transparent: true`).
- **Picasa Idle Mouse Fade**:
  - When an image is displayed and the mouse is stationary for 2.5 seconds, all UI chrome (titlebar, floating pill toolbar, badges) fades smoothly to `opacity: 0` (`pointer-events: none`).
  - As soon as the user moves the mouse, controls instantly fade back in.
- **Navigation & Canvas Ergonomics**:
  - High-performance 60 FPS HTML5 Canvas pan and zoom.
  - Smooth mouse wheel zoom anchored to cursor coordinates.
  - Arrow keys (Left/Right) for instant navigation across neighbor images in the current folder.
  - Quick keys: `F` (Fit to screen), `1` (100% 1:1 Actual size), `,` / `.` (Rotate Left / Right), `Esc` (Exit fullscreen / Close), `C` (Crop), `D` (Draw), `E` (Filters), `I` (Metadata), `Ctrl+S` (Save), `Ctrl+Shift+S` (Save As), `Ctrl+Z` / `Ctrl+Y` (Undo/Redo drawing).

### Pillar 5: Strict Modularity Architecture (No Monoliths)
- **Hard Rule — Maximum 300 Lines Per File**: No source code file (`.js`, `.css`, `.rs`) may exceed **300 lines of code**. Any file approaching this limit must be proactively refactored into focused submodules.
  - **Coordinator Exception**: Pure bootstrap and orchestration entry-points that only wire up existing modules — specifically `src/app.js`, `src/settings-app.js`, and `src-tauri/src/main.rs` — are permitted up to **350 lines**. These files contain no business logic of their own; they exclusively instantiate, inject, and connect focused submodules. Feature logic must never be added inline to justify this exception.
- **Single Responsibility Principle**: Each file must do one thing well:
  - UI components manage only DOM rendering and user interaction events.
  - Services handle external concerns (Tauri IPC, updater, filesystem, shortcuts, window modes, change tracking, image saving).
  - Core engines handle computation, drawing, filters, and canvas rendering.
- **Never Dump Feature Code into `app.js` or `style.css`**: Feature additions must create dedicated, importable modules. `app.js` and `settings-app.js` may only contain wiring (instantiation, callback binding, delegation) — never business logic, styling, or self-contained feature implementations.

---

## 2. Directory Structure & Module Standards

All source files in the project strictly respect the < 300 lines per file budget (coordinator entry-points up to 350 lines):

```
bukaake/
├── .agents/
│   └── workflows/                 # Specialized Agent Workflows
│       ├── orchestrator.md        # Multi-phase task coordinator (~50 lines)
│       ├── architect.md           # Planning & system design (~70 lines)
│       ├── coding-specialist.md   # Code executor (~80 lines)
│       └── code-reviewer.md       # Quality & 5-pillar auditor (~75 lines)
├── AGENTS.md                      # Authoritative project rules manual
├── package.json                   # Version 0.4.1 single source of truth
├── index.html                     # Main viewer entrypoint
├── settings.html                  # Dedicated standalone settings window
├── scripts/
│   └── bump-version.js            # Atomic version synchronizer across json/toml (~65 lines)
├── src/
│   ├── components/                # Isolated UI modules (< 250 lines each)
│   │   ├── adjustments-panel.js   # Color sliders, preset chips (~115 lines)
│   │   ├── confirm-modal.js       # Unsaved changes confirmation dialog (~70 lines)
│   │   ├── context-menu.js        # Glass desktop right-click context menu (~215 lines)
│   │   ├── delete-modal.js        # Stroke-free Recycle Bin & delete dialog (~80 lines)
│   │   ├── metadata-drawer.js     # EXIF, camera telemetry, dimensions drawer (~40 lines)
│   │   ├── settings-modal.js      # Glass settings & updater modal overlay (~205 lines)
│   │   ├── shortcuts-modal.js     # Keyboard shortcuts cheat sheet (~40 lines)
│   │   ├── titlebar.js            # Window controls, filename badge, image info (~155 lines)
│   │   ├── toast.js               # Single-toast lifecycle notification pill (~60 lines)
│   │   └── toolbar.js             # Responsive floating control dock & draw popover (~250 lines)
│   ├── core/                      # Core canvas, drawing & image math engines (< 260 lines each)
│   │   ├── canvas-events.js       # Pan/zoom mouse & drag event handler (~105 lines)
│   │   ├── canvas-helpers.js      # Coordinate transforms & math utilities (~65 lines)
│   │   ├── canvas-viewer.js       # 60fps pan/zoom canvas engine & fit logic (~250 lines)
│   │   ├── crop-snapping.js       # Edge/center laser magnet snapping guides (~145 lines)
│   │   ├── cropper.js             # Precision crop overlay, sandwich contrast (~200 lines)
│   │   ├── drawing-tool.js        # Freehand pen, highlighter, cursor ring & baking (~260 lines)
│   │   ├── filters.js             # Color adjustment processor (~95 lines)
│   │   └── metadata.js            # EXIF parser, camera telemetry & GPS reader (~195 lines)
│   ├── services/                  # External & platform services (< 270 lines each)
│   │   ├── canvas-tools-manager.js# Tool mutual exclusivity & interaction lockout (~110 lines)
│   │   ├── change-tracker.js      # Unsaved edits state tracking (~50 lines)
│   │   ├── file-assoc-service.js  # Windows Shell capability registration & deep link (~85 lines)
│   │   ├── file-loader.js         # Image file loader, drag & drop, clipboard (~265 lines)
│   │   ├── idle-controller.js     # Picasa-style idle mouse fade controller (~105 lines)
│   │   ├── image-prefetch-cache.js# Asymmetric 5-slot prefetch cache with LRU eviction (~140 lines)
│   │   ├── image-saver.js         # Tauri & web image saving, copy to clipboard (~90 lines)
│   │   ├── shortcuts.js           # Keyboard hotkeys registry (~140 lines)
│   │   ├── standby-service.js     # Background standby, tray lifecycle & memory trim (~85 lines)
│   │   ├── tauri-bridge.js        # Tauri v2 window, args, fs IPC wrapper (~265 lines)
│   │   ├── theme-manager.js       # Dark & light theme switcher + acrylic tint (~85 lines)
│   │   ├── updater-service.js     # GitHub releases updater & multi-window sync (~250 lines)
│   │   └── window-mode-manager.js # Regular vs Fullscreen mode coordinator (~125 lines)
│   ├── styles/                    # Modular CSS design system (< 245 lines each)
│   │   ├── base.css               # Typography, reset, SVG checkerboard (~110 lines)
│   │   ├── glass.css              # Core glassmorphism classes & ambient shadows (~80 lines)
│   │   ├── main.css               # Master stylesheet bundling component submodules (~25 lines)
│   │   ├── tokens.css             # Stroke-free glass tokens (dark & light) (~115 lines)
│   │   └── components/            # Component-specific stylesheets
│   │       ├── confirm-modal.css  # Glass confirmation dialogs (unsaved & delete) (~180 lines)
│   │       ├── context-menu.css   # Glass context menu with high-contrast backing (~110 lines)
│   │       ├── crop.css           # Precision crop box, sandwich contrast, guides (~240 lines)
│   │       ├── draw.css           # Floating drawing toolbar & popover styling (~195 lines)
│   │       ├── modes.css          # Mode 1 regular vs Mode 2 fullscreen viewer (~235 lines)
│   │       ├── panels.css         # Adjustments, metadata, and glass pill buttons (~230 lines)
│   │       ├── settings.css       # Standalone settings window & modal styling (~245 lines)
│   │       ├── settings-assoc.css # Default image viewer banner & toggle button (~155 lines)
│   │       ├── shortcuts.css      # Keyboard shortcuts modal styling (~60 lines)
│   │       ├── startpage.css      # Empty drop zone, capabilities strip & format matrix (~220 lines)
│   │       ├── titlebar.css       # Frameless ghost titlebar & disabled states (~230 lines)
│   │       ├── toast.css          # Stroke-free floating glass toast pill (~60 lines)
│   │       ├── toolbar.css        # Responsive floating control dock (~175 lines)
│   │       └── vibrancy.css       # Window vibrancy & background layer overrides (~70 lines)
│   ├── app.js                     # Main window bootstrap coordinator (≤ 350 lines, coordinator exception)
│   └── settings-app.js            # Standalone settings window coordinator (~230 lines)
└── src-tauri/
    ├── Cargo.toml                 # Tauri v2 dependencies (`window-vibrancy`, `rfd`, `image`, `kamadak-exif`, `winreg`, `heif-oxide`)
    ├── tauri.conf.json            # Multi-window config (main + settings)
    └── src/
        ├── main.rs                # App entry-point: plugin setup, lifecycle, window events (≤ 350 lines, coordinator exception)
        ├── window_commands.rs     # All #[tauri::command] window/dialog/vibrancy IPC handlers (~185 lines)
        ├── file_assoc.rs          # Windows registry capabilities, auto-heal & deep link (~145 lines)
        ├── image_loader.rs        # Fast native image decoding & metadata reading (~270 lines)
        ├── raw_reader.rs          # 15ms embedded preview extractor for 8 RAW formats (~60 lines)
        ├── heif_reader.rs         # Native HEIC/HEIF container and thumbnail extractor (~70 lines)
        ├── wic_decoder.rs         # Windows Imaging Component hardware-accelerated transcoding (~145 lines)
        ├── pro_decoder.rs         # VFX & texture decoders (HDR, EXR, DDS, TGA, QOI) (~25 lines)
        ├── exif_reader.rs         # Native EXIF camera telemetry & GPS extraction (~140 lines)
        ├── file_ops.rs            # Native Win32 Recycle Bin & permanent deletion (~70 lines)
        ├── clipboard.rs           # Native OS clipboard engine, CF_HDROP & image IPC (~150 lines)
        ├── standby.rs             # Tray standby lifecycle, working set trim & auto-quit (~150 lines)
        └── updater.rs             # Native in-place self-updater, progress & relaunch (~145 lines)
```

---

## 3. Technology Stack & Commands

| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Desktop Framework** | Tauri v2 | `@tauri-apps/cli` ^2.0.0, `tauri` ^2.0.0 |
| **Backend Language** | Rust | Edition 2021 |
| **Windows Acrylic** | `window-vibrancy` | 0.6.0 (`apply_acrylic`, `clear_acrylic`) |
| **Native Dialogs** | `rfd` | 0.15 (Native file open and save dialogs) |
| **Image Processing** | `image` & `kamadak-exif` | 0.25 (Image decoding) & 0.6 (Camera EXIF telemetry) |
| **Clipboard Engine** | `arboard` & Win32 APIs | 3.4 (`CF_HDROP`, `CF_DIB`, zero browser permission prompts) |
| **File Operations** | Win32 Shell API | `SHFileOperationW` for safe Recycle Bin deletion |
| **Auto-Updater** | Custom GitHub Service | `src/services/updater-service.js` querying GitHub Releases API |
| **Frontend Bundler** | Vite | ^5.4.0 (Multi-page ES Modules: `index.html`, `settings.html`) |
| **Frontend Core** | Vanilla JavaScript | ES6+ Modules, No Heavy Frameworks |
| **Styling** | Vanilla CSS | Stroke-free Glassmorphism, CSS Custom Properties |
| **Icons** | Remix Icons & Monochrome SVG | Clean vector icons (`ri-*` classes, `currentColor`) |
| **Typography** | Inter & JetBrains Mono | Google Fonts |

### Common CLI Commands
- `npm run dev` — Launch Vite local dev server (port 3000)
- `npm run tauri:dev` — Launch Tauri v2 desktop application in development mode (uncapped multi-core)
- `npm run build` — Compile production Vite bundle
- `npm run tauri:build` — Build standalone portable Windows release executable (uncapped multi-core)
- `npm run bump` — Atomically bump version across `package.json`, `Cargo.toml`, and `tauri.conf.json`

### Control Center (`run.bat` / `run.ps1`)
The root control center provides an interactive 10-option manager:
- `[1]` Live Dev: Native Desktop Window (`npm run tauri:dev`)
- `[2]` Live Dev: Instant Web/Edge Window (`npm run dev`)
- `[3]` **Build Fast x64 App** — Zero LTO, 16 codegen units, multi-core parallel, incremental (`cargo build --profile fast`) -> `release-builds/bukaake-v<ver>-x64-fast.exe`
- `[4]` **Build Production x64 App** — Multi-core dependency build, `opt-level=z`, fat LTO, symbol strip, panic abort -> `release-builds/bukaake-v<ver>-x64.exe`
- `[5]` **Build Production ARM64 App** — Cross-compiles for `aarch64-pc-windows-msvc`
- `[6]` **Build Both Architectures** — Sequential x64 and ARM64 release builds
- `[7]` **Bump Version** — Patch, minor, major, or custom version synchronizer
- `[8]` **Quick Run** — Launches the latest compiled executable (checks fast, release, and debug targets)
- `[9]` **Clean Build Artifacts & Locks** — Purges `dist/`, cargo cache, and stale process locks
- `[10]` **Exit**

### Compilation Rule
- **No Automatic Production Binary Builds**: Agents must **NOT** automatically compile the full desktop application (`cargo build --release` / `tauri build`) once a task is finished. Use fast validation (`npm run build` for frontend bundle and `cargo check` for Rust type-checking). Full binary compilation is reserved for when the user explicitly requests it or executes it via `run.bat` / `run.ps1`.

---

## 4. Subsystem Architectures

### Native Multi-Format & RAW Decoder Subsystem
- **Instant RAW Preview Extraction (`src-tauri/src/raw_reader.rs`)**:
  - Extracts full-resolution embedded JPEG previews from camera RAW files in ~15ms without slow demosaicing.
  - Supports: Sony (`.arw`), Canon (`.cr2`, `.cr3`), Nikon (`.nef`), Adobe DNG / DJI (`.dng`), Fujifilm (`.raf`), Panasonic Lumix (`.rw2`), Olympus (`.orf`), Pentax (`.pef`).
- **VFX & Texture Decoders (`src-tauri/src/pro_decoder.rs`)**:
  - Direct decoding of HDR (`.hdr`), OpenEXR (`.exr`), Truevision Targa (`.tga`), DirectDraw Surface (`.dds`), Netpbm (`.pnm`), Quite OK Image (`.qoi`).
- **Directory Traversal**:
  - Indices all 27+ formats in `image_loader.rs` for seamless `Left`/`Right` arrow navigation across mixed directories.

### Camera EXIF Telemetry Subsystem
- **Native Telemetry Engine (`src-tauri/src/exif_reader.rs`, `src/core/metadata.js`)**:
  - Extracts hardware profile: Camera Make/Model, Lens Model.
  - Exposure telemetry: Aperture ($f$-number), Shutter Speed, ISO, Exposure Bias.
  - Optical metrics: 35mm equivalent Focal Length, Metering Mode, Flash status.
  - Environmental data: Date/Time captured and precision GPS Coordinates.
  - Preserves original disk metadata across in-memory Crop and Draw edits.

### Precision Crop & Snapping Subsystem
- **Dual-Stroke Sandwich Contrast Layering (`src/styles/components/crop.css`)**:
  - High-luminance 1px core flanked by bilateral dark casing shadows on `.crop-box` and `.crop-grid-line` to guarantee visibility over pure white, deep black, and textured photos.
  - White-fill rounded handles (`.crop-handle`) with dark outlines and ambient drop shadows.
- **Image-Spanning Magnetic Guides (`src/core/crop-snapping.js`)**:
  - Detects image edges and centers, projecting high-intensity cyan laser guidelines across the entire image.
- **In-Crop Ergonomics (`src/core/cropper.js`)**:
  - Scroll-wheel zoom while cropping with boundary clamping.
  - Synchronizes dynamic in-crop rotation and flipping via two-pass offscreen canvas rendering.

### Editing Exclusivity & Safety Guardrails
- **Tool Exclusivity Engine (`src/services/canvas-tools-manager.js`)**:
  - Enforces mutual exclusivity between Crop (`C`), Draw (`D`), and Adjustments (`E`).
  - Interaction lockout: suppresses context menus, folder navigation (`Left`/`Right`), and file deletion hotkeys while an active editing session is open.

### Native Win32 File Deletion Subsystem
- **Native Operations (`src-tauri/src/file_ops.rs`, `src/components/delete-modal.js`)**:
  - Safe Recycle Bin deletion (`Delete` key) via `SHFileOperationW` (`FO_DELETE`, `FOF_ALLOWUNDO`).
  - Permanent file destruction (`Shift + Delete`).
  - Stroke-free frosted glass confirmation dialog with ambient drop shadows and automatic neighbor image navigation upon deletion.

### Native OS Clipboard Subsystem
- **Core Native Engine (`src-tauri/src/clipboard.rs`)**:
  - Eliminates WebView2 permission popups by handling clipboard access via Windows OS APIs.
  - Extracts image file paths from Explorer files (`CF_HDROP`) and indexes sibling folder images.
  - Decodes raster images (`CF_DIB`) via `arboard`, serializing to PNG base64 data URLs.
  - Provides native clipboard image writing for `Ctrl+C` and processed image exports.
- **Frontend IPC Integration (`src/services/tauri-bridge.js`, `src/services/file-loader.js`, `src/services/image-saver.js`)**:
  - `tauriBridge.readClipboard()` and `writeClipboardImage()` invoke native backend commands.
  - `Ctrl+V` and titlebar paste triggers protected by `confirmModal.promptIfDirty()`.

### Interactive Drawing & Highlighting Subsystem
- **Core Tool (`src/core/drawing-tool.js`)**:
  - Dedicated overlay canvas synchronized to viewport size.
  - Dual modes: `pen` (sharp, opaque, round joins) and `highlighter` (40% translucent, wide chisel stroke).
  - Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`) discrete stroke stacks.
  - Viewport-to-image coordinate mapping via `canvasViewer.screenToImageCoords` with `ctx.clip()` containment.
  - Dynamic cursor preview ring reflecting pen stroke size in real time.

### Change Tracking & Safe Export Lifecycle
- **Change Tracker (`src/services/change-tracker.js`)**:
  - Tracks dirty status across Crop, Color adjustments, and Drawing.
  - Ignores pure viewport transforms (rotation, flipping, pan, zoom) per design pillars.
- **Unsaved Changes Dialog (`src/components/confirm-modal.js`)**:
  - Guards destructive actions (opening images, folder navigation, window closing).
- **Image Saver (`src/services/image-saver.js`)**:
  - Supports instant clipboard copying of processed images via `copyProcessedImage` (routed through native `writeClipboardImage` in Tauri).

### Windows Shell File Association & Auto-Healing Subsystem
- **Registry Registration & Deep-Link (`src-tauri/src/file_assoc.rs`, `src/services/file-assoc-service.js`)**:
  - Registers ProgID `Bukaake.ImageViewer`, `Capabilities\FileAssociations`, and `RegisteredApplications` under `HKCU` (zero UAC elevation required).
  - Registers 38 graphic formats (standard raster, camera RAW, HDR/VFX textures, SVG, animated formats) and Windows Explorer right-click context menu ("Open with Bukaake").
  - Seamlessly triggers Windows Default Apps settings via `ms-settings:defaultapps?registeredAppUser=Bukaake`.
  - Supports full unregistration, cleanly pruning ProgID and Capabilities keys without touching unrelated configurations.
- **Silent Startup Path Auto-Healing**:
  - On application startup (`auto_heal_or_sync_path` in `src-tauri/src/main.rs`), compares current binary path against registered registry command.
  - If the portable executable is moved or renamed, silently updates shell open command in place, preserving existing Windows `UserChoice` hashes without requiring the user to reassign defaults in Windows Settings.
- **Glass Settings Banner & Interactive Switch (`src/styles/components/settings-assoc.css`, `src/settings-app.js`, `src/components/settings-modal.js`)**:
  - Stroke-free frosted glass banner with vertically centered monochrome shield icon (`ri-shield-check-line`), 38 Formats tag, active executable path badge, and single-button toggle (`Register` / `Unregister`).

### Hardware-Accelerated WIC & HEIC/HEIF Subsystem
- **Native WIC In-Memory Transcoding (`src-tauri/src/wic_decoder.rs`)**:
  - Leverages Windows Imaging Component COM interfaces (`IWICImagingFactory`, `IWICBitmapDecoder`) to decode system-supported codecs directly on GPU/hardware.
  - Transcodes frames to standard JPEG/PNG in-memory memory streams (`CreateStreamOnHGlobal`) without disk I/O, serving immediate DataURLs to the canvas.
- **HEIC / HEIF Container Extraction (`src-tauri/src/heif_reader.rs`)**:
  - Integrates `heif-oxide` for container parsing and embedded preview extraction, falling back seamlessly to WIC native HEIF extensions.

### Asymmetric Directional Prefetch Cache Subsystem
- **Directional 5-Slot Window (`src/services/image-prefetch-cache.js`)**:
  - Maintains an in-memory prefetch cache of decoded base64 image data during folder navigation.
  - Implements asymmetric directional biasing: preloads +3 images ahead in the active traversal direction and +1 image behind.
  - Automated LRU eviction bounds memory usage strictly to 5 cached images, guaranteeing instant, 0ms latency on `Left`/`Right` arrow keys without memory bloat.

### Background Standby & Process Lifecycle Subsystem
- **Tray Standby & Memory Trim (`src-tauri/src/standby.rs`, `src/services/standby-service.js`)**:
  - Keeps Bukaake running warm in the Windows system notification tray for sub-10ms subsequent image launches.
  - Performs native Win32 working set memory trimming via `K32EmptyWorkingSet` upon entering standby, dropping resident RAM footprint to ~8-15 MB.
  - Auto-quits standby cleanly after 5 minutes of inactivity (`STANDBY_TIMEOUT_SECS = 300`) to preserve host system resources.
  - Stroke-free system tray menu featuring **Settings** and **Exit Bukaake**.
  - Configurable via user setting toggle (`bukaake_standby_enabled`), synchronized across windows and persisted in `localStorage`.
- **Cold Mode 2 Spawn & Decoding Feedback (`src/app.js`, `src/components/toast.js`)**:
  - Direct spawn into Mode 2 Fullscreen Viewer on cold image launch or Explorer single-instance invocation, bypassing startpage or Mode 1 window jitter.
  - Immediate loading indicator feedback during high-resolution RAW / HEIC / VFX decoding.

### Fast Multi-Core Compilation Architecture
- **Dedicated Fast Profile (`src-tauri/Cargo.toml`)**:
  - `[profile.fast]` inherits from `release`, with `opt-level = 1`, `lto = false`, `codegen-units = 16`, and `incremental = true`. Eliminates the multi-minute LTO linking bottleneck while keeping runtime performance fast.
- **Dynamic Multi-Core CPU Allocation**:
  - `run.bat` and `run.ps1` dynamically assign `CARGO_BUILD_JOBS` to all available CPU threads (`%NUMBER_OF_PROCESSORS%` / `ProcessorCount`), utilizing 12+ cores for parallel dependency compilation across both Fast and Production builds.

---

## 5. Agent Role & Execution Guidelines

1. **Architect (`/architect`)**:
   - Performs deep analysis of current codebase.
   - Outputs implementation plans adhering to the 5 Pillars (including Stroke-Free Glass, Zero Focus Outlines, and Mode 2 Zero-Blur with 75% scale ceiling).
   - Enforces file size budgets (< 300 lines) and explicit modular breakdowns across components, services, and core engines.
   - Does NOT write final implementation code.

2. **Coding Specialist (`/coding-specialist`)**:
   - Implements features strictly matching architectural specifications.
   - Never creates monolithic files or adds bloat to existing files.
   - Builds UI using stroke-free glassmorphism tokens and classes (no 1px borders, no focus outlines).
   - Ensures all UI functions seamlessly in both deep dark and light themes (using obsidian slate `#242938` for light mode dark accents).
   - Integrates Tauri v2 APIs, drawing tools, change tracking, and multi-window IPC cleanly.

3. **Code Reviewer (`/code-reviewer`)**:
   - Audits code against the **Bukaake 5-Pillar Checklist**:
     1. Stroke-Free Glassmorphism styling validated (no border strokes, no 1px dividing lines, zero focus outlines).
     2. Dual-theme compatibility verified (deep obsidian dark mode, no hardcoded colors, zero pure black in light mode).
     3. Auto-updater service verified for safety, rate-limit handling, and multi-window sync.
     4. Mode transitions verified (regular mode acrylic vs fullscreen viewer strictly transparent with 75% brightness, zero blur, 75% fit ceiling, centered titlebar).
     5. Strict modularity check: **Instantly reject any file exceeding 300 lines.**

4. **Orchestrator (`/orchestrator`)**:
   - Breaks down multi-step tasks into clear, atomic specialist subtasks.
   - Tracks execution progress across Architect, Coding Specialist, and Code Reviewer.
   - Ensures quality handoffs and synthesizes results for the user.

5. **Universal Rule — Never Assume, Always Ask**:
   - Agents MUST NEVER assume the user's aesthetic, functional, or architectural intentions when an instruction or design nuance is subjective, ambiguous, or underspecified.
   - If user intent is unclear or open to interpretation, agents MUST actively ask clarifying questions before committing changes.

