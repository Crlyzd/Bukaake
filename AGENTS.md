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
- **Native Acrylic Tint Coordination**: Rust backend applies Windows Acrylic in coordination with the theme: `Some((16, 19, 28, 175))` for dark, `Some((245, 247, 250, 105))` for light.

### Pillar 3: GitHub Releases Auto-Updater & Native Self-Updating
- **Updater Architecture (`updater-service.js`, `updater.rs`)**: Queries GitHub Releases API with semver checks and x64/arm64 asset detection.
- **Native In-Place Updating**: Downloads binaries via `curl.exe` (with PowerShell fallback), emits live progress (`bukaake-update-progress`), replaces the running executable via `self-replace`, and cleanly restarts.
- **Multi-Window Sync & Visual Telemetry**: Synchronizes update state across main and settings windows via `localStorage` and Tauri events. Settings "About" nav tab features a stroke-free ambient sky glow (`has-update`) and animated pulsating heartbeat indicator when a new version is detected.
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
- **Navigation & Ergonomics**: Smooth mouse wheel zoom anchored to cursor; `Up`/`Down` arrow keys for intuitive centered/anchored zoom in and zoom out (matching Picasa navigation alongside mouse wheel); `Left`/`Right` arrow keys for directory navigation; quick keys `F` (fit), `1` (1:1), `,`/`.` (rotate), `Esc` (exit/close), `C` (crop), `D` (draw), `E` (filters), `I` (EXIF info), `Q` (full RAW decode), `Delete` (Recycle Bin), `Shift+Delete` (permanent delete), `Ctrl+V` (paste image).

### Pillar 5: Strict Modularity Architecture (< 300 Lines per File)
- **Hard Rule**: No source file (`.js`, `.css`, `.rs`) may exceed **300 lines of code**. Files approaching this limit must be proactively split into focused modules.
- **Coordinator Exception (Max 350 Lines)**: Pure bootstrap and orchestration entry-points that only instantiate, inject, and wire submodules—specifically `src/app.js`, `src/settings-app.js`, and `src-tauri/src/main.rs`—are permitted up to **350 lines**. No business logic or styling may be placed directly in coordinator files.
- **Single Responsibility**: UI components handle DOM events only; services handle Tauri IPC, state, and external systems; core engines handle canvas transforms, drawing, and math.

---

## 2. Directory Structure & Codebase Map

The project contains **100+ modular files** cleanly organized across distinct layers:

```
src/
├── components/          # UI Component Modules (< 300 lines each)
│   ├── viewer/                 # Main viewing chrome (titlebar, titlebar-loader, toolbar, context menu, toast)
│   ├── modals/                 # Modals (confirm, delete, shortcuts)
│   ├── capture/                # Screen snipper, recording dock, OCR & tools
│   ├── settings/               # Settings window sections & modal
│   └── text/                   # Floating text typography sub-toolbar
├── core/                # Canvas & Image Math Engines (< 300 lines each)
│   ├── canvas/                 # Canvas viewer engine, events & helpers
│   ├── crop/                   # Precision crop box & laser magnetic guides
│   ├── draw/                   # Freehand pen, highlighter, cursor ring
│   ├── filters/                # Real-time color adjustments processor
│   ├── metadata/               # Client EXIF parser & telemetry formatter
│   └── text/                   # Typography lifecycle, snapping & rendering
├── services/            # Platform & Domain Services (< 300 lines each)
│   ├── platform/               # Windows OS, autostart, file associations, tray & window mode
│   ├── image/                  # Image loader, prefetch cache, RAW load controller & file exporter
│   ├── interaction/            # Hotkeys, shortcuts, idle controller & change tracker
│   ├── capture/                # Screen capture, native recorder, audio & screenshot saver
│   └── integrations/           # External companion integrations (Alitken, Cathet)
├── styles/              # Stroke-Free Modular Stylesheets (< 300 lines each)
│   ├── base.css, glass.css, main.css, tokens.css
│   └── components/     # viewer/ (including titlebar-loader.css), modals/, tools/, capture/, settings/, text/
├── app.js               # Main viewer bootstrap coordinator (≤ 350 lines)
├── settings-app.js      # Standalone settings window coordinator (≤ 350 lines)
└── snipper-app.js       # Dedicated overlay window coordinator (≤ 300 lines)
src-tauri/src/
├── main.rs              # App entry-point & master IPC dispatcher (≤ 350 lines)
├── capture/             # Native Screen Capture & Hardware Recording Subsystem
│   ├── mod.rs                  # Module exports & conditional declarations
│   ├── audio_capture.rs        # WASAPI loopback & microphone audio capture
│   ├── audio_mixer.rs          # FIFO resampling queue, clock sync & peak limiter
│   ├── capture_commands.rs     # Screen snip & recording IPC commands
│   ├── d3d_device.rs           # Direct3D 11 device & WinRT interop
│   ├── ebml_patcher.rs         # WebM duration & seek header patcher
│   ├── native_recorder.rs      # GPU capture orchestrator & audio PTS sync
│   ├── recording_border.rs     # Stroke-free capture region border overlay
│   ├── recording_pill.rs       # Floating desktop recording pill controller
│   ├── screen_capture.rs       # Windows desktop monitor & region capture
│   ├── wgc_capture.rs          # Windows.Graphics.Capture D3D11 frame pool
│   └── wmf_writer.rs           # IMFSinkWriter hardware H.264/AAC MP4 writer
├── imaging/             # Image Decoders & VFX Pipelines
│   ├── mod.rs                  # Module exports
│   ├── exif_reader.rs          # Native EXIF extraction via kamadak-exif
│   ├── heif_reader.rs          # HEIC/HEIF container parsing & preview extraction
│   ├── image_loader.rs         # Native image decoding & 49 format traversal
│   ├── neighbor_scanner.rs     # Directory neighbor traversal & CLI argument scanner (< 100 lines)
│   ├── pro_decoder.rs          # VFX decoders (HDR, EXR, DDS, TGA, QOI)
│   ├── raw_reader.rs           # 4-tier LibRaw camera RAW pipeline (< 300 lines)
│   ├── raw_tests.rs            # Dedicated LibRaw sample test harness
│   └── wic_decoder.rs          # Windows Imaging Component GPU transcoder
├── platform/            # Native Windows Desktop Integration
│   ├── mod.rs                  # Module exports
│   ├── autostart.rs            # HKCU autostart registry management
│   ├── clipboard.rs            # Win32 clipboard engine (CF_HDROP / CF_DIB)
│   ├── file_assoc.rs           # HKCU shell registration & auto-heal
│   ├── file_ops.rs             # Win32 Recycle Bin deletion (SHFileOperationW)
│   ├── hotkeys.rs              # Win32 global shortcut listener
│   ├── process_memory.rs       # Working set telemetry & memory trimming
│   ├── standby.rs              # Tray lifecycle & working set memory trimming
│   ├── updater.rs              # In-place self-updater, progress & relaunch
│   ├── wallpaper.rs            # Win32 desktop wallpaper engine & cache transcode (< 110 lines)
│   ├── window_commands.rs      # Window vibrancy, dialogs, and window state IPC
│   └── window_subclass.rs      # Win32 subclassing & native edge resize suppression
└── integrations/        # External & Companion App Integrations
    ├── mod.rs                  # Module exports
    ├── cathet.rs               # Cathet companion bridge commands
    └── ocr.rs                  # Native Windows.Media.Ocr text recognition
```

---

## 3. Subsystem Specifications

### Screen Capture & Recording Subsystem
- **Screen Snipper (`screen-snipper.js`, `screen_capture.rs`, `capture_commands.rs`)**:
  - Fullscreen transparent overlay with crosshair coordinates, dimension badges, and click-drag region selection.
  - Multi-monitor awareness via native Windows monitor bounds enumeration.
  - Capture modes: Full Screen, Active Monitor, Custom Region.
  - Auto-Save & Clipboard: Automatically copies captured snips to clipboard (`CF_DIB`) and writes timestamped PNGs to the user's Pictures/Screenshots directory via `screenshot-saver.js`.
- **Native GPU Screen Recording & Hardware Encoding (`d3d_device.rs`, `wgc_capture.rs`, `wmf_writer.rs`, `native_recorder.rs`, `recording-dock.js`, `screen-recorder-service.js`, `audio_capture.rs`, `audio_mixer.rs`, `recording_border.rs`, `recording_pill.rs`)**:
  - **Zero-Copy VRAM Capture (`Windows.Graphics.Capture`, `wgc_capture.rs`, `d3d_device.rs`)**: Captures desktop frames directly into D3D11 GPU textures via `Direct3D11CaptureFramePool` (`B8G8R8A8UIntNormalized`). Zero CPU memory round-trips. Region capture uses fast GPU subresource blits (`CopySubresourceRegion`).
  - **Hardware H.264/AAC SinkWriter (`wmf_writer.rs`)**: Uses Windows Media Foundation `IMFSinkWriter` with DXGI surface buffer wrapping to encode hardware H.264 video (`MFVideoFormat_H264`) and AAC audio (`MFAudioFormat_AAC`) directly to native `.mp4` files. Delivers Snipping Tool parity (< 2% CPU overhead, solid 60 FPS).
  - **Sample-Accurate WASAPI Audio Sync & Desync Resolution (`audio_capture.rs`, `audio_mixer.rs`, `native_recorder.rs`)**:
    - **Continuous Silence Synthesis**: Synthesizes 48kHz stereo zero-sample pairs `(0.0, 0.0)` during silent, uninitialized, or late-starting feeds, ensuring monotonic, contiguous audio PTS strictly matching video PTS.
    - **Atomic Pause Compensation (`total_paused_nanos`)**: Subtracts accumulated pause duration atomically (`AtomicU64`) from video elapsed time (`effective_nanos = elapsed.saturating_sub(paused)`), matching the audio pause PTS timeline across pause/resume cycles.
    - **Audio Sync Calibration Stepper**: Configurable manual offset (`-200ms` to `+200ms` in 10ms increments) persisted in `localStorage` (`bukaake-audio-sync-offset`) and passed through IPC (`syncOffsetMs`) into the native recorder PTS pipeline.
  - **Space Saver Recording Mode & Dynamic Presets (`native_recorder.rs`, `screen-recorder-service.js`, `settings-capture-section.js`)**:
    - Standard mode records at uniform 60 FPS (Balanced 6 Mbps, High 12 Mbps, Ultra 24 Mbps).
    - Space Saver mode yields ~75% file size reduction via 30 FPS profiles at 25% target bitrates (Balanced 1.5 Mbps, High 3 Mbps, Ultra 6 Mbps) with native recorder clamp floor reduced to 500 Kbps.
    - Dynamic dropdown labels adapt immediately to the toggle state in real time.
  - Stroke-free frosted recording dock with live timer, pause/resume, and stop/discard buttons.
  - Native overlay border around recorded region (`recording_border.rs`) with zero window chrome. Automatic toast notification and optional external editor launch upon finalization.
- **Dedicated Transparent Overlay Window (`snipper.html`, `snipper-app.js`, `tauri.conf.json`)**:
  - Decouples all capture crosshairs, selection bounds, and floating recording pills into an isolated transparent secondary window (`snipper`).
  - Eliminates main window hide/restore cycles, DWM DirectComposition redraw flash, and Acrylic recreation flicker.
  - Zero residue: ensures crosshair overlays and post-recording blur backdrops cleanly unmount without intercepting desktop mouse clicks or resurfacing on subsequent triggers.
- **Alitken Tandem Workflow (`alitken-service.js`)**:
  - Deep-link bridge allowing one-click transfer of active images to Alitken for advanced editing and seamless auto-reload in Bukaake upon save.
- **Unified Hotkeys (`hotkey-service.js`, `hotkeys.rs`)**:
  - Coordinates global Windows shortcuts and in-app triggers for instant capture without input conflicts.

### Camera RAW & VFX Subsystem
- **Statically Linked LibRaw Engine (`LibRaw 0.21.2`, `raw_reader.rs`)**:
  - Compiles LibRaw statically via `build.rs` into single portable binary without external DLL dependencies.
  - **4-Tier Pipeline**: Tier 1 (Instant embedded JPEG preview ~15ms), Tier 2 (Full sensor unpack & demosaicing via `Q`), Tier 3 (Byte-stream scanner for legacy GPR/X3F), Tier 4 (Pure Rust linear DNG fallback).
  - Memory Bounds: 150 MB per-file ceiling and 140 MB total prefetch pool (`image-prefetch-cache.js`) prevent RAM spikes on large RAW sequences.
  - Supported Formats: 24+ camera RAW formats (.cr2, .cr3, .nef, .arw, .raf, .dng, etc.) and VFX textures (.hdr, .exr, .dds, .tga, .qoi).
- **High-Throughput Binary IPC & Non-Blocking Async Decoding (`read_raw_full_sensor_binary`, `raw-load-controller.js`)**:
  - **Zero-Base64 Binary IPC**: `read_raw_full_sensor_binary` delivers raw JPEG bytes directly via `tauri::ipc::Response::new(bytes)`, skipping Base64 encoding and string allocation overhead across the Tauri IPC bridge.
  - **Off-Thread Rust Execution (`spawn_blocking`)**: Heavy disk I/O, directory context scans, and LibRaw processing execute asynchronously on dedicated blocking threads (`spawn_blocking`), preventing UI hitches or Tauri async runtime executor stalls.
  - **Off-Thread Browser Rasterization**: Uses `img.decode()` off the main thread prior to rendering, delivering silky smooth transitions.
  - **Session Token Cancellation (`loadSessionId`)**: Monotonic session IDs discard slower or stale decodes when users navigate rapidly via Arrow keys or mouse wheel, immediately revoking Object URLs to prevent memory leaks.
- **Titlebar Ambient Glowing Loading Beam (`titlebar-loader.js`, `titlebar-loader.css`)**:
  - Dual-theme continuous dual-train laser animation across titlebar bottom (`Mode 1`) or monitor top edge (`Mode 2`) indicates background RAW decoding without layout shifts.
  - Smooth emerald flash (`#34d399`) upon completion before cross-fading away; titlebar stays pinned and steady during background decodes.

### Precision Crop, Drawing & Editing Exclusivity
- **Precision Crop (`cropper.js`, `crop-snapping.js`, `crop.css`)**:
  - Dual-stroke sandwich contrast layering (1px core flanked by dark casing shadows) guarantees visibility on pure white or pure black photos.
  - Magnetic laser guides detect image edges and centers with dynamic snapping.
- **Drawing Tool (`drawing-tool.js`, `draw.css`)**:
  - Screen-to-image coordinate mapping (`screenToImageCoords`), strokes clipped strictly to image bounds (`ctx.clip()`), discrete undo stack (`Ctrl+Z`).
- **Tool Exclusivity (`canvas-tools-manager.js`)**:
  - Crop, Draw, and Color Adjustments are mutually exclusive; activating any tool locks out context menus, directory navigation, and file deletion.
- **Change Safety (`change-tracker.js`, `confirm-modal.js`)**:
  - Tracks dirty status on crop, draw, and filter changes; prompts before navigation, file opening, or closing.

### Platform Integration, Standby & File Associations
- **Native Recycle Bin (`file_ops.rs`, `delete-modal.js`)**: Win32 `SHFileOperationW` (`FO_DELETE` + `FOF_ALLOWUNDO`) for safe Recycle Bin deletion with automatic navigation to neighbor images.
- **Native OS Clipboard (`clipboard.rs`)**: Uses Windows APIs (`CF_HDROP` / `CF_DIB`) eliminating WebView2 permission popups. Supports dual `base64Data`/`base64` parameters for snipped region clipboard delivery.
- **Native Desktop Wallpaper Subsystem (`wallpaper.rs`, `image-saver.js`, `context-menu.js`)**:
  - Direct Win32 wallpaper setting via `SystemParametersInfoW` (`SPI_SETDESKWALLPAPER`, `SPIF_UPDATEINIFILE | SPIF_SENDCHANGE`).
  - Automatically renders edited canvas / non-native formats (WebP, AVIF, TIFF, RAW) to `%APPDATA%\Bukaake\bukaake_wallpaper.png` cache before applying, preventing Windows grey desktop background glitches.
  - Context menu item enabled for native formats or modified images.
- **Explorer Single-Instance Launch Placement & Fullscreen Protection**:
  - Single-instance launch unminimizes window placement (`unminimize()`) before entering fullscreen when opened from Windows Explorer.
  - `isPendingPathLoad` guard in `window-mode-manager.js` suppresses race-condition fullscreen teardown during image path IPC transfer.
- **Official Resources Portal & Contrast Calibration**:
  - Settings About tab and main settings modal feature direct links to the official website ([bukaake.kaleksananbagus.com](https://bukaake.kaleksananbagus.com)) and GitHub repository.
  - Elevated contrast for version tag chips in dark mode (`--text-main` over `--glass-btn-hover-bg`).
- **Tray Standby & Memory Trim (`standby.rs`, `standby-service.js`)**:
  - Persistent background tray daemon; trims working set memory via `K32EmptyWorkingSet` down to ~8-15 MB RAM. Left-click on tray immediately restores window cleanly into Mode 1.
  - **Zero Hardcoded Centering Invariant**: Never invoke `win.center()` on window close, hide, or tray wake. Always preserve user window position and multi-monitor coordinates.
  - **Clean Standby Hide Invariant**: In `enter_standby`, only invoke `win.hide()`. Never apply `set_size` or repositioning during hide, as Win32/Tauri renders moves before completing the hide, causing an unsightly screen jump/flash glitch.
  - **Startup Window Size Lock & WS_THICKFRAME Invariant**: Startup dimensions locked to 680×480. **Never call `set_resizable(false)` natively on Windows**. In Windows 11 DWM, stripping `WS_THICKFRAME` forces DWM to draw an active 1px white border around frameless windows and removes rounded corners/shadows. Window size locking on startup is enforced via DOM handle suppression (`body:not(.image-loaded) .resize-handle { display: none !important; }`), while fixed dialogs (Settings) use native Win32 `WM_NCHITTEST` subclassing (`window_subclass.rs`) to remap edge hit-tests to `HTCLIENT` and block `SC_SIZE` modal loops, keeping `resizable: true` (`WS_THICKFRAME`) active so borders remain completely eliminated and corners stay rounded without resize flicker.
  - **Win32 Titlebar Maximize Interception Invariant**: The main window subclasses `WM_NCLBUTTONDBLCLK` and `SC_MAXIMIZE` in `window_subclass.rs` to intercept titlebar double-clicks and DWM maximize requests, routing them smoothly via the `bukaake-toggle-mode` event directly into Mode 2 transparent fullscreen without DWM maximize flash or Acrylic recreation flicker.
  - **Return-to-Start Brand Button & Window Reset**: The titlebar app icon converts to an interactive back button (`ri-arrow-left-line`) with cross-fade on hover in Mode 1 when an image is loaded. Clicking checks `changeTracker.hasUnsavedChanges()` before triggering the confirmation dialog, clears the active image, and resets/centers the window dimensions back to the default 680×480 start state.
  - **Empty State Aspect Isolation**: In `window-mode-manager.js`, `resizeAndCenter` is strictly guarded by `if (this.viewer?.img && this.lastAspectSize)`. `handleEmptyState()` must always clear `this.windowModeManager.lastAspectSize = null`.
- **Shell File Association (`file_assoc.rs`, `file-assoc-service.js`)**:
  - Registers ProgID and capabilities for 49 formats under `HKCU` (zero UAC prompts).
  - Silent auto-healing on startup checks binary location and updates registry commands in-place if executable is moved.

---

## 4. Development & Build Rules

### Agent Output Protocol & Workspace Hygiene

- **Artifact Isolation Protocol**: **ALL planning, analysis, release note drafts, behaviour descriptions, and architectural decisions MUST be written directly into the active task artifact file** in the designated IDE artifact directory (`<appDataDir>\brain\<conversation-id>`). Chat responses may only contain a 1-3 sentence pointer to the artifact plus any open questions.
- **Zero Artifact Littering Policy**: **Agents must NEVER litter the project workspace with temporary artifacts, drafts, scratch notes, or release note markdown files** (e.g. `RELEASE_NOTES_*.md`, plan docs). The project repository must remain strictly clean and contain only production codebase files, official repository docs (`README.md`, `AGENTS.md`), and build assets.

### Release Notes Invariant: Hyped Milestone Format & Zero-Repetition

Whenever drafted, release notes **MUST ALWAYS** follow this mandatory standard:
- **Hyped & Celebratory Tone**: Release notes must be high-energy, exciting, and proud—celebrating Bukaake's mission of reviving Google Picasa's distraction-free desktop immersion with modern stroke-free frosted glass and Rust/Tauri v2 warp-speed performance.
- **Electrifying Structure**:
  - **Milestone Manifesto**: Grand opening proclamation with celebratory emojis (`🚀 Bukaake vX.Y.Z — THE ... RELEASE! 🎉`).
  - **High-Impact Superpower Headings**: Bold, catchy feature titles prioritizing user excitement before deep technical explanations (e.g., *🖼️ Native Desktop Wallpaper Engine — Your Art on Your Desktop in 1 Click!*).
  - **Technical Depth & Mastery**: Back the excitement with exact architectural details (Win32 APIs, zero-copy VRAM blits, zero-Base64 binary streaming, memory clamps, non-blocking thread offloading).
  - **Curated Commit Table**: Cleanly structured commit log (`Commit`, `Scope`, `Description`).
  - **Download & Portal CTA**: Clear call-to-action with links to the official website and GitHub Releases portable download (~5MB single executable).
- **Zero-Repetition Policy**: When composing release notes for any release (e.g. v1.0.0), agents **MUST NEVER** repeat features, architectural highlights, or bug fixes that were already documented in prior version release notes (e.g. v0.9.0, v0.8.1, v0.8.0, etc.).
- **Commit Range Isolation**: Release notes must strictly document novel changes introduced between the previous release tag (`v(N-1)`) and the target release (`vN`).
- **Pre-Release Audit Requirement**: Agents must cross-reference prior GitHub Releases or git tag history before writing release documentation to ensure all entries are strictly novel.

### Fast Validation Commands
- `npm run dev` — Launch Vite dev server on port 3000.
- `npm run tauri:dev` — Launch Tauri v2 desktop app in development mode.
- `npm run build` — Fast production bundle check for frontend assets.
- `cargo check --manifest-path src-tauri/Cargo.toml` — Fast backend type-check.
- `npm run bump` — Atomically synchronize version across `package.json`, `Cargo.toml`, and `tauri.conf.json`.

### Compilation Invariant
- **No Automatic Production Binary Builds**: Agents must **NEVER** run `cargo build --release` or `npm run tauri:build` autonomously after completing tasks. Full compilation is exclusively initiated by the user or via the root control center (`run.bat` / `run.ps1`).
- **Universal Rule — Never Assume, Always Ask**: If user requirements or aesthetic nuances are ambiguous, agents must ask clarifying questions before committing changes.
