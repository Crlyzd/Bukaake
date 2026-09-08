# Bukaake — Project Agent Guidelines & Architecture Manual

> **Bukaake**: A high-performance, lightweight, and portable Windows image viewer built with Rust, Tauri v2, and modern Vanilla Web technologies, reviving the fluid, desktop-immersive experience of the classic **Google Picasa Photo Viewer**.

---

## 1. Core Architectural Pillars

All agents working on this repository **MUST** strictly enforce these five non-negotiable architectural pillars:

### Pillar 1: Modern Stroke-Free Glassmorphism Design System
- **Materials**: `backdrop-filter: blur(20px) saturate(180%)` with translucent RGBA/HSLA background fills.
- **Zero Lines / Strokes Policy**: **Never use 1px border strokes, lines, or specular highlight outlines** on windows, floating toolbars, buttons, cards, popovers, or dialogs. Visual boundaries and depth are created exclusively through translucent frosted glass fills and soft, multi-layered ambient drop shadows (`box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5)`). Dividers between controls must use transparent spacing margins (`width: 5px; background: transparent;`).
- **Zero Browser Focus Rings**: Declare `outline: none !important;` on `:focus` and `:focus-visible` for all interactive elements to prevent browser outline artifacts over frosted glass.
- **Card & Overlay Optical Isolation**: Menus, popovers, context menus, and dialogs rendered over user imagery must use high-opacity dark obsidian backing (`rgba(14, 18, 27, 0.92)`) and deep ambient shadows (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55)`) to guarantee legibility over bright photos.
- **Single-Toast Lifecycle**: Notification toasts never stack vertically; the toast manager seamlessly replaces active toasts with smooth entry/exit animations.
- **Typography & Monochrome Icons**: Inter for UI, JetBrains Mono for metadata/telemetry. All UI icons **MUST** be minimalist monochrome SVGs or Remix Icons (`ri-*`) inheriting `currentColor`. **Zero Emojis Policy**: Never use colorful system emojis or raw unicode arrows in UI markup.

### Pillar 2: Dual Theme Engine (Dark & Light)
- **CSS Custom Properties**: Strictly use design tokens (`--glass-bg`, `--glass-border: transparent`, `--glass-panel-bg`, `--text-main`, `--text-muted`, `--text-dim`, `--action-bg`, `--action-text`). Hardcoded color literals in component CSS are prohibited.
- **Deep Obsidian Dark Mode**: True deep obsidian dark (`rgba(6, 7, 10, 0.92)`), never washed-out blue or gray.
- **Zero Pure Black in Light Mode Policy**: **Never use pure black (`#000000`, `#0a0a0a`, `#111111`, raw `rgba(0,0,0,...)`) in Light Mode**. Dark accents, active chips, slider thumbs, and primary text in Light Mode MUST use refined obsidian slate (`#242938` / `#2a3142`, alphas anchored to `rgba(26, 32, 44, ...)`). Panel dividers use ultra-subtle slate tint `rgba(26, 32, 44, 0.08)`.
- **Canvas Display States**: (1) Pure Crystal Transparency (desktop wallpaper / acrylic shows through) or (2) Deep Obsidian Slate Checkerboard (inline vector SVG pattern `#161922` / `#252a38`).
- **Native Acrylic Tint Coordination**: Rust backend applies Windows Acrylic in coordination with the theme: `Some((16, 19, 28, 248))` for dark, `Some((245, 247, 250, 140))` for light.

### Pillar 3: GitHub Releases Auto-Updater & Native Self-Updating
- **Updater Architecture (`updater-service.js`, `updater.rs`)**: Queries GitHub Releases API with semver checks and x64/arm64 asset detection.
- **Native In-Place Updating**: Downloads binaries via `curl.exe` (with PowerShell fallback), emits live progress (`bukaake-update-progress`), replaces the running executable via `self-replace`, and cleanly restarts.
- **Multi-Window Sync**: Synchronizes update state across main and settings windows via `localStorage` and Tauri events.
- **Mode 2 Fullscreen Exclusion**: In Fullscreen Mode (`body.mode-viewer`), launch update checks are completely disabled. In Mode 1, background checks delay by 1.5s post-startup.

### Pillar 4: Dual-Mode & Picasa-Style Transparent Viewing
- **Mode 1: Regular App Mode (`body.mode-regular`)**: Centered aspect-ratio window with docked frameless titlebar and native Windows acrylic blur.
- **Mode 2: Fullscreen Image Viewer Mode (`body.mode-viewer`)**:
  - **CRITICAL IMMERSION INVARIANT**: Must ALWAYS remain strictly transparent with lowered brightness (75%) and **NO blur** (`clear_acrylic(&main_win)` in Rust and `backdrop-filter: brightness(0.75)` + `background: rgba(0, 0, 0, 0.30)` in CSS). Never add blur, opacity, or window borders to Mode 2.
  - **Centered Ghost Titlebar**: Titlebar centered at top (`left: 50% !important; transform: translateX(-50%) !important; max-width: 85vw`) with high-contrast ambient text-shadows.
  - **Fullscreen 75% Scale Ceiling**: Images on fit/load occupy at most **75%** of viewport width and height (`0.75`), keeping surrounding wallpaper visible.
  - **Elevated Floating Toolbar**: Control dock elevated to `bottom: 80px !important;` to avoid colliding with the Windows taskbar, with a 140px bottom mouse-hover threshold.
  - **Checkerboard Disabled in Mode 2**: Canvas checkerboard toggle is disabled/dimmed to preserve desktop immersion.
- **Picasa Idle Mouse Fade**: 2.5s of stationary mouse fades all UI chrome to `opacity: 0` (`pointer-events: none`); mouse movement restores controls immediately.
- **Navigation & Ergonomics**: Smooth mouse wheel zoom anchored to cursor; `Left`/`Right` arrow keys for directory navigation; quick keys `F` (fit), `1` (1:1), `,`/`.` (rotate), `Esc` (exit/close), `C` (crop), `D` (draw), `E` (filters), `I` (EXIF info), `Q` (full RAW decode), `Delete` (Recycle Bin), `Shift+Delete` (permanent delete), `Ctrl+V` (paste image).

### Pillar 5: Strict Modularity Architecture (< 300 Lines per File)
- **Hard Rule**: No source file (`.js`, `.css`, `.rs`) may exceed **300 lines of code**. Files approaching this limit must be proactively split into focused modules.
- **Coordinator Exception (Max 350 Lines)**: Pure bootstrap and orchestration entry-points that only instantiate, inject, and wire submodules—specifically `src/app.js`, `src/settings-app.js`, and `src-tauri/src/main.rs`—are permitted up to **350 lines**. No business logic or styling may be placed directly in coordinator files.
- **Single Responsibility**: UI components handle DOM events only; services handle Tauri IPC, state, and external systems; core engines handle canvas transforms, drawing, and math.

---

## 2. Directory Structure & Codebase Map

The project contains **70+ modular files** cleanly organized across distinct layers:

```
src/
├── components/          # UI Component Modules (< 300 lines each)
│   ├── adjustments-panel.js    # Sliders & preset chips
│   ├── confirm-modal.js        # Unsaved changes dialog
│   ├── context-menu.js         # Right-click obsidian glass menu
│   ├── delete-modal.js         # Recycle Bin & delete dialog
│   ├── loading-indicator.js    # Circular stroke-free spinner
│   ├── metadata-drawer.js      # EXIF & camera telemetry drawer
│   ├── recording-dock.js       # Screen recording floating dock & controls
│   ├── screen-snipper.js       # Interactive screen capture crosshair & snip overlay
│   ├── settings-capture-section.js # Capture & recording settings panel
│   ├── settings-modal.js       # In-app settings & updater overlay
│   ├── shortcuts-modal.js      # Keyboard shortcuts cheatsheet
│   ├── titlebar.js             # Frameless titlebar & window actions
│   ├── toast.js                # Single-toast notification pill
│   └── toolbar.js              # Floating control dock & tool triggers
├── core/                # Canvas & Image Math Engines (< 300 lines each)
│   ├── canvas-events.js        # Pan/zoom mouse & drag events
│   ├── canvas-helpers.js       # Coordinate transforms & math
│   ├── canvas-viewer.js        # 60fps pan/zoom canvas engine & fit logic
│   ├── crop-snapping.js        # Laser magnetic alignment guides
│   ├── cropper.js              # Precision crop box & sandwich contrast
│   ├── drawing-tool.js         # Freehand pen, highlighter, cursor ring
│   ├── filters.js              # Real-time color adjustments processor
│   └── metadata.js             # Client EXIF parser & telemetry formatter
├── services/            # Background, Platform & State Services (< 300 lines each)
│   ├── alitken-service.js      # External editor tandem workflow integration
│   ├── canvas-tools-manager.js # Tool mutual exclusivity & interaction lockout
│   ├── capture-manager.js      # Capture/record coordinator & auto-save flow
│   ├── change-tracker.js       # Unsaved edits state tracker
│   ├── file-assoc-service.js   # Windows shell associations & deep-link
│   ├── file-loader.js          # Image loader, drag & drop, clipboard ingest
│   ├── hotkey-service.js       # Unified global/local shortcut dispatcher
│   ├── idle-controller.js      # Picasa-style idle mouse fade controller
│   ├── image-prefetch-cache.js # 5-slot directional prefetch cache (140MB bound)
│   ├── image-saver.js          # File export & clipboard image writer
│   ├── screen-capture-service.js # Tauri desktop capture IPC bridge
│   ├── screen-recorder-service.js# Video recording & media recorder service
│   ├── screenshot-saver.js     # Timestamped auto-save & directory management
│   ├── shortcuts.js            # Main viewer keyboard shortcut registry
│   ├── standby-service.js      # System tray standby & memory trimming
│   ├── tauri-bridge.js         # Tauri v2 window, args, and fs IPC wrapper
│   ├── theme-manager.js        # Dark/light switcher & acrylic coordination
│   ├── updater-service.js      # GitHub Releases auto-updater service
│   └── window-mode-manager.js  # Mode 1 regular vs Mode 2 fullscreen coordinator
├── styles/              # Stroke-Free Modular Stylesheets (< 300 lines each)
│   ├── base.css, glass.css, main.css, tokens.css
│   └── components/     # confirm-modal, context-menu, crop, draw, loading, modes,
│                       # panels, recording, settings-assoc, settings-capture,
│                       # settings, shortcuts, snipper, startpage, titlebar, toast, toolbar, vibrancy
├── app.js               # Main viewer bootstrap coordinator (≤ 350 lines)
└── settings-app.js      # Standalone settings window coordinator (≤ 350 lines)
src-tauri/src/
├── main.rs              # App entry-point, plugins & lifecycle (≤ 350 lines)
├── capture_commands.rs  # Screen capture, snip & recording IPC commands
├── clipboard.rs         # Win32 clipboard engine (CF_HDROP / CF_DIB)
├── exif_reader.rs       # Native EXIF extraction via kamadak-exif
├── file_assoc.rs        # HKCU shell registration & silent startup auto-heal
├── file_ops.rs          # Win32 Recycle Bin deletion (SHFileOperationW)
├── heif_reader.rs       # HEIC/HEIF container parsing & preview extraction
├── image_loader.rs      # Native image decoding & 49 format traversal
├── pro_decoder.rs       # VFX & texture decoders (HDR, EXR, DDS, TGA, QOI)
├── raw_reader.rs        # 4-tier LibRaw camera RAW pipeline & full sensor unpack
├── recording_border.rs  # Stroke-free desktop capture region border overlay
├── recording_pill.rs    # Floating desktop recording pill controller
├── screen_capture.rs    # Native Windows desktop monitor & region capture
├── standby.rs           # Tray lifecycle & working set memory trimming
├── updater.rs           # In-place self-updater, progress & relaunch
├── wic_decoder.rs       # Windows Imaging Component GPU-accelerated transcoding
└── window_commands.rs   # Window vibrancy, dialogs, and window state IPC
```

---

## 3. Subsystem Specifications

### Screen Capture & Recording Subsystem
- **Screen Snipper (`screen-snipper.js`, `screen_capture.rs`, `capture_commands.rs`)**:
  - Fullscreen transparent overlay with crosshair coordinates, dimension badges, and click-drag region selection.
  - Multi-monitor awareness via native Windows monitor bounds enumeration.
  - Capture modes: Full Screen, Active Monitor, Custom Region.
  - Auto-Save & Clipboard: Automatically copies captured snips to clipboard (`CF_DIB`) and writes timestamped PNGs to the user's Pictures/Screenshots directory via `screenshot-saver.js`.
- **Screen Recording (`recording-dock.js`, `screen-recorder-service.js`, `recording_border.rs`, `recording_pill.rs`)**:
  - Stroke-free frosted recording dock with live timer, pause/resume, and stop/discard buttons.
  - Native overlay border around recorded region (`recording_border.rs`) with zero window chrome.
  - Low-RAM stream-to-disk chunking exporting directly to WebM (VP9/Opus) with automatic toast notification and optional external editor launch.
- **Alitken Tandem Workflow (`alitken-service.js`)**:
  - Deep-link bridge allowing one-click transfer of active images to Alitken for advanced editing and seamless auto-reload in Bukaake upon save.
- **Unified Hotkeys (`hotkey-service.js`)**:
  - Coordinates global Windows shortcuts and in-app triggers for instant capture without input conflicts.

### Camera RAW & VFX Subsystem
- **Statically Linked LibRaw Engine (`LibRaw 0.21.2`, `raw_reader.rs`)**:
  - Compiles LibRaw statically via `build.rs` into single portable binary without external DLL dependencies.
  - **4-Tier Pipeline**: Tier 1 (Instant embedded JPEG preview ~15ms), Tier 2 (Full sensor unpack & demosaicing via `Q`), Tier 3 (Byte-stream scanner for legacy GPR/X3F), Tier 4 (Pure Rust linear DNG fallback).
  - Memory Bounds: 150 MB per-file ceiling and 140 MB total prefetch pool (`image-prefetch-cache.js`) prevent RAM spikes on large RAW sequences.
  - Supported Formats: 24+ camera RAW formats (.cr2, .cr3, .nef, .arw, .raf, .dng, etc.) and VFX textures (.hdr, .exr, .dds, .tga, .qoi).

### Precision Crop, Drawing & Editing Exclusivity
- **Precision Crop (`cropper.js`, `crop-snapping.js`, `crop.css`)**:
  - Dual-stroke sandwich contrast layering (1px core flanked by dark casing shadows) guarantees visibility on pure white or pure black photos.
  - Magnetic laser guides detect image edges and centers with dynamic snapping.
- **Drawing Tool (`drawing-tool.js`, `draw.css`)**:
  - Screen-to-image coordinate mapping (`screenToImageCoords`), strokes clipped strictly to image bounds (`ctx.clip()`), discrete undo/redo stacks (`Ctrl+Z` / `Ctrl+Y`).
- **Tool Exclusivity (`canvas-tools-manager.js`)**:
  - Crop, Draw, and Color Adjustments are mutually exclusive; activating any tool locks out context menus, directory navigation, and file deletion.
- **Change Safety (`change-tracker.js`, `confirm-modal.js`)**:
  - Tracks dirty status on crop, draw, and filter changes; prompts before navigation, file opening, or closing.

### Platform Integration, Standby & File Associations
- **Native Recycle Bin (`file_ops.rs`, `delete-modal.js`)**: Win32 `SHFileOperationW` (`FO_DELETE` + `FOF_ALLOWUNDO`) for safe Recycle Bin deletion with automatic navigation to neighbor images.
- **Native OS Clipboard (`clipboard.rs`)**: Uses Windows APIs (`CF_HDROP` / `CF_DIB`) eliminating WebView2 permission popups. Supports dual `base64Data`/`base64` parameters for snipped region clipboard delivery.
- **Tray Standby & Memory Trim (`standby.rs`, `standby-service.js`)**:
  - Persistent background tray daemon; trims working set memory via `K32EmptyWorkingSet` down to ~8-15 MB RAM. Left-click on tray immediately restores window cleanly into Mode 1.
  - **Zero Hardcoded Centering Invariant**: Never invoke `win.center()` on window close, hide, or tray wake. Always preserve user window position and multi-monitor coordinates.
  - **Clean Standby Hide Invariant**: In `enter_standby`, only invoke `win.hide()`. Never apply `set_size` or repositioning during hide, as Win32/Tauri renders moves before completing the hide, causing an unsightly screen jump/flash glitch.
  - **Startup Window Size Lock**: Startup window dimensions locked to 680×480 with native `set_resizable(false)` and `set_maximizable(false)`. Edge resize handles and cursors are suppressed in `startpage.css` when `body:not(.image-loaded)`. Resizing is dynamically enabled only when an image is loaded.
  - **Empty State Aspect Isolation**: In `window-mode-manager.js`, `resizeAndCenter` is strictly guarded by `if (this.viewer?.img && this.lastAspectSize)`. `handleEmptyState()` must always clear `this.windowModeManager.lastAspectSize = null`.
- **Shell File Association (`file_assoc.rs`, `file-assoc-service.js`)**:
  - Registers ProgID and capabilities for 49 formats under `HKCU` (zero UAC prompts).
  - Silent auto-healing on startup checks binary location and updates registry commands in-place if executable is moved.

---

## 4. Development & Build Rules

### Fast Validation Commands
- `npm run dev` — Launch Vite dev server on port 3000.
- `npm run tauri:dev` — Launch Tauri v2 desktop app in development mode.
- `npm run build` — Fast production bundle check for frontend assets.
- `cargo check --manifest-path src-tauri/Cargo.toml` — Fast backend type-check.
- `npm run bump` — Atomically synchronize version across `package.json`, `Cargo.toml`, and `tauri.conf.json`.

### Compilation Invariant
- **No Automatic Production Binary Builds**: Agents must **NEVER** run `cargo build --release` or `npm run tauri:build` autonomously after completing tasks. Full compilation is exclusively initiated by the user or via the root control center (`run.bat` / `run.ps1`).
- **Universal Rule — Never Assume, Always Ask**: If user requirements or aesthetic nuances are ambiguous, agents must ask clarifying questions before committing changes.
