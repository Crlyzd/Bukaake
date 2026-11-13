# Bukaake â€” Project Agent Guidelines & Architecture Manual

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
- **Mode 2 Fullscreen & Standby Exclusion**: In Fullscreen Mode (`body.mode-viewer`), launch update checks are completely disabled. On autostart / standby launch (`--startup`), checks are gated via `updater-launch-gate.js` and deferred until the window is woken from standby. In Mode 1 normal launch, background checks delay by 1.5s post-startup.

### Pillar 4: Dual-Mode & Picasa-Style Transparent Viewing
- **Mode 1: Regular App Mode (`body.mode-regular`)**: Centered aspect-ratio window with docked frameless titlebar and native Windows acrylic blur.
- **Mode 2: Fullscreen Image Viewer Mode (`body.mode-viewer`)**:
  - **CRITICAL IMMERSION INVARIANT**: Must ALWAYS remain strictly transparent with lowered brightness (75%) and **NO blur** (`clear_acrylic(&main_win)` in Rust and `backdrop-filter: brightness(0.75)` + `background: rgba(0, 0, 0, 0.30)` in CSS). Never add blur, opacity, or window borders to Mode 2.
  - **Centered Ghost Titlebar**: Titlebar centered at top (`left: 50% !important; transform: translateX(-50%) !important; max-width: 85vw`) with high-contrast ambient text-shadows.
  - **Fullscreen 75% Scale Ceiling**: Images on fit/load occupy at most **75%** of viewport width and height (`0.75`), keeping surrounding wallpaper visible.
  - **Elevated Floating Toolbar**: Control dock elevated to `bottom: 80px !important;` to avoid colliding with the Windows taskbar, with a 140px bottom mouse-hover threshold.
  - **Checkerboard Disabled in Mode 2**: Canvas checkerboard toggle is disabled/dimmed to preserve desktop immersion.
- **Picasa Idle Mouse Fade**: 2.5s of stationary mouse fades all UI chrome to `opacity: 0` (`pointer-events: none`); mouse movement restores controls immediately.
- **Navigation & Ergonomics**: Smooth mouse wheel zoom anchored to cursor; `Up`/`Down` arrow keys for intuitive centered/anchored zoom in and zoom out (matching Picasa navigation alongside mouse wheel); `Left`/`Right` arrow keys for directory navigation; quick keys `F` (fit), `1` (1:1), `,`/`.` (rotate), `Esc` (layered: closes open tool popovers, exits active editor, or exits/closes viewer), `C` (crop), `D` (draw), `U` (blur/pixelate), `T` (text), `E` (filters), `I` (EXIF info), `Q` (full RAW decode), `Delete` (Recycle Bin), `Shift+Delete` (permanent delete), `Ctrl+V` (paste image).

### Pillar 5: Strict Modularity Architecture (< 300 Lines per File)
- **Hard Rule**: No source file (`.js`, `.css`, `.rs`) may exceed **300 lines of code**. Files approaching this limit must be proactively split into focused modules.
- **Coordinator Exception (Max 350 Lines)**: Pure bootstrap and orchestration entry-points that only instantiate, inject, and wire submodulesâ€”specifically `src/app.js`, `src/settings-app.js`, and `src-tauri/src/main.rs`â€”are permitted up to **350 lines**. No business logic or styling may be placed directly in coordinator files.
- **Single Responsibility**: UI components handle DOM events only; services handle Tauri IPC, state, and external systems; core engines handle canvas transforms, drawing, and math.

---

## 2. Directory Structure & Codebase Map

The project contains **100+ modular files** cleanly organized across distinct layers:

```
history.md               # Living project documentation, agent memory & mistake log
src/
â”œâ”€â”€ components/          # UI Component Modules (< 300 lines each)
â”‚   â”œâ”€â”€ viewer/                 # Main viewing chrome (titlebar, titlebar-loader, toolbar, tool-hud, context menu, toast)
â”‚   â”œâ”€â”€ modals/                 # Modals (confirm, delete, shortcuts)
â”‚   â”œâ”€â”€ capture/                # Screen snipper, action dock, color picker, OCR & recording dock
â”‚   â”œâ”€â”€ settings/               # Settings window sections (capture, audio, click, general, tandem, modal)
â”‚   â”œâ”€â”€ text/                   # Floating text typography sub-toolbar
â”‚   â””â”€â”€ tools/                  # Editing tool sub-toolbars (blur-toolbar)
â”œâ”€â”€ core/                # Canvas & Image Math Engines (< 300 lines each)
â”‚   â”œâ”€â”€ blur/                   # Non-stacking blur/pixelate tool & offscreen renderer
â”‚   â”œâ”€â”€ canvas/                 # Canvas viewer engine, events, FLIP & helpers
â”‚   â”œâ”€â”€ crop/                   # Precision crop box & laser magnetic guides
â”‚   â”œâ”€â”€ draw/                   # Freehand pen, highlighter, stroke smoother & cursor ring
â”‚   â”œâ”€â”€ filters/                # Real-time color adjustments processor
â”‚   â”œâ”€â”€ metadata/               # Client EXIF parser & telemetry formatter
â”‚   â””â”€â”€ text/                   # Typography lifecycle, snapping & rendering
â”œâ”€â”€ locales/             # Multi-Language Dictionaries & Manifest (< 30 lines manifest)
â”‚   â”œâ”€â”€ manifest.js             # Locale registry & metadata
â”‚   â”œâ”€â”€ en.json, id.json        # English, Indonesian dictionaries
â”‚   â””â”€â”€ jv-ngoko.json, jv-krama.json, jv-malangan.json # Javanese Ngoko, Krama & Malangan dictionaries
â”œâ”€â”€ services/            # Platform & Domain Services (< 300 lines each)
â”‚   â”œâ”€â”€ platform/               # Windows OS, autostart, file assoc, i18n, updater-launch-gate, tray & window mode
â”‚   â”œâ”€â”€ image/                  # Image loader, prefetch cache, RAW load controller & file exporter
â”‚   â”œâ”€â”€ interaction/            # Hotkeys, shortcuts, idle controller & change tracker
â”‚   â”œâ”€â”€ capture/                # Screen capture, native recorder, audio stream receiver & screenshot saver
â”‚   â””â”€â”€ integrations/           # External companion integrations (Alitken, Cathet)
â”œâ”€â”€ styles/              # Stroke-Free Modular Stylesheets (< 300 lines each)
â”‚   â”œâ”€â”€ base.css, glass.css, main.css, tokens.css
â”‚   â””â”€â”€ components/     # viewer/ (including titlebar-loader.css), modals/, tools/, capture/, settings/, text/
â”œâ”€â”€ app.js               # Main viewer bootstrap coordinator (â‰¤ 350 lines)
â”œâ”€â”€ settings-app.js      # Standalone settings window coordinator (â‰¤ 350 lines)
â””â”€â”€ snipper-app.js       # Dedicated overlay window coordinator (â‰¤ 300 lines)
packaging/               # Microsoft Store & Packaging Automation
â”œâ”€â”€ store-config.json    # Store identity & package configuration
â””â”€â”€ msix/                # AppxManifest.template.xml & visual tile assets
scripts/                 # Automation & Release Scripts
â”œâ”€â”€ bump-version.js      # Synchronized version bump script
â”œâ”€â”€ generate-store-assets.ps1 # Store icon & tile asset generator
â”œâ”€â”€ i18n-tool.js         # Bi-directional JSON/template i18n translation helper
â””â”€â”€ package-msix.ps1     # Microsoft Store MSIX packaging pipeline
src-tauri/src/
â”œâ”€â”€ main.rs              # App entry-point & master IPC dispatcher (â‰¤ 350 lines)
â”œâ”€â”€ capture/             # Native Screen Capture & Hardware Recording Subsystem
â”‚   â”œâ”€â”€ mod.rs                  # Module exports & conditional declarations
â”‚   â”œâ”€â”€ audio_capture.rs        # WASAPI loopback & microphone audio capture
â”‚   â”œâ”€â”€ audio_mixer.rs          # FIFO resampling queue, clock sync & peak limiter
â”‚   â”œâ”€â”€ capture_commands.rs     # Screen snip & recording IPC commands
â”‚   â”œâ”€â”€ click_coordinator.rs    # Low-level click event and visual/audio coordinator
â”‚   â”œâ”€â”€ click_overlay.rs        # Stroke-free translucent animated click ripple overlay
â”‚   â”œâ”€â”€ click_sound.rs          # Tactile mechanical click audio synthesizer
â”‚   â”œâ”€â”€ d3d_device.rs           # Direct3D 11 device & WinRT interop
â”‚   â”œâ”€â”€ ebml_patcher.rs         # WebM duration & seek header patcher
â”‚   â”œâ”€â”€ external_launch.rs      # Alitken companion launcher & file pickers (< 85 lines)
â”‚   â”œâ”€â”€ mouse_hook.rs           # Win32 low-level mouse hook (WH_MOUSE_LL)
â”‚   â”œâ”€â”€ native_recorder.rs      # GPU capture orchestrator & audio PTS sync
â”‚   â”œâ”€â”€ recording_border.rs     # Stroke-free capture region border overlay
â”‚   â”œâ”€â”€ recording_pill.rs       # Floating desktop recording pill controller
â”‚   â”œâ”€â”€ screen_capture.rs       # Windows desktop monitor & region capture
â”‚   â”œâ”€â”€ wgc_capture.rs          # Windows.Graphics.Capture D3D11 frame pool
â”‚   â””â”€â”€ wmf_writer.rs           # IMFSinkWriter hardware H.264/AAC MP4 writer
â”œâ”€â”€ imaging/             # Image Decoders & VFX Pipelines
â”‚   â”œâ”€â”€ mod.rs                  # Module exports
â”‚   â”œâ”€â”€ exif_reader.rs          # Native EXIF extraction via kamadak-exif
â”‚   â”œâ”€â”€ heif_reader.rs          # HEIC/HEIF container parsing & preview extraction
â”‚   â”œâ”€â”€ image_loader.rs         # Native image decoding & 49 format traversal
â”‚   â”œâ”€â”€ neighbor_scanner.rs     # Directory neighbor traversal & CLI argument scanner (< 100 lines)
â”‚   â”œâ”€â”€ pro_decoder.rs          # VFX decoders (HDR, EXR, DDS, TGA, QOI)
â”‚   â”œâ”€â”€ raw_reader.rs           # 4-tier LibRaw camera RAW pipeline (< 300 lines)
â”‚   â”œâ”€â”€ raw_tests.rs            # Dedicated LibRaw sample test harness
â”‚   â””â”€â”€ wic_decoder.rs          # Windows Imaging Component GPU transcoder
â”œâ”€â”€ platform/            # Native Windows Desktop Integration
â”‚   â”œâ”€â”€ mod.rs                  # Module exports
â”‚   â”œâ”€â”€ autostart.rs            # HKCU autostart registry management
â”‚   â”œâ”€â”€ bootstrapper.rs         # Pre-flight OS/WebView2 runtime check & auto-installer
â”‚   â”œâ”€â”€ clipboard.rs            # Win32 clipboard engine (CF_HDROP / CF_DIB)
â”‚   â”œâ”€â”€ file_assoc.rs           # HKCU shell registration & auto-heal
â”‚   â”œâ”€â”€ file_ops.rs             # Win32 Recycle Bin deletion (SHFileOperationW)
â”‚   â”œâ”€â”€ foreground.rs           # Win32 foreground lock bypass (ASFW_ANY + AttachThreadInput)
â”‚   â”œâ”€â”€ hotkeys.rs              # Win32 global shortcut listener
â”‚   â”œâ”€â”€ package_info.rs         # MSIX package identity & Store runtime detection (< 70 lines)
â”‚   â”œâ”€â”€ process_memory.rs       # Working set telemetry & memory trimming
â”‚   â”œâ”€â”€ reclaim.rs              # Idle working set memory reclaim coordinator (< 110 lines)
â”‚   â”œâ”€â”€ standby.rs              # Tray lifecycle & working set memory trimming
â”‚   â”œâ”€â”€ updater.rs              # In-place self-updater, progress & relaunch
â”‚   â”œâ”€â”€ wallpaper.rs            # Win32 desktop wallpaper engine & cache transcode (< 110 lines)
â”‚   â”œâ”€â”€ window_commands.rs      # Window vibrancy, dialogs, and window state IPC
â”‚   â”œâ”€â”€ window_subclass.rs      # Win32 subclassing & native edge resize suppression
â”‚   â””â”€â”€ window_transition.rs    # DWM cloaking & atomic Mode 1 <-> Mode 2 geometry commits
â””â”€â”€ integrations/        # External & Companion App Integrations
    â”œâ”€â”€ mod.rs                  # Module exports
    â”œâ”€â”€ cathet.rs               # Cathet companion bridge & subprocess isolation (< 80 lines)
    â””â”€â”€ ocr.rs                  # Native Windows.Media.Ocr text recognition
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
  - **Click Highlights & Tactile Sound Feedback (`mouse_hook.rs`, `click_coordinator.rs`, `click_overlay.rs`, `click_sound.rs`, `settings-click-section.js`)**:
    - Win32 low-level mouse hook (`WH_MOUSE_LL`) detects left/right mouse clicks exclusively during active screen recording sessions.
    - `click_coordinator.rs` triggers stroke-free animated ripple rings (`click_overlay.rs`) centered on cursor coordinates.
    - Synthesizes tactile mechanical click audio (`click_sound.rs`) mixed into WASAPI audio streams or playback feeds.
    - Configurable cursor visibility toggle (`includeCursor`), click highlight ripple toggle, and audio click toggle persisted in settings with collapsible accordion UI.
  - Stroke-free frosted recording dock with live timer, pause/resume, and stop/discard buttons.
  - Native overlay border around recorded region (`recording_border.rs`) with zero window chrome. Automatic toast notification and optional external editor launch upon finalization.
- **Dedicated Transparent Overlay Window (`snipper.html`, `snipper-app.js`, `tauri.conf.json`)**:
  - Decouples all capture crosshairs, selection bounds, and floating recording pills into an isolated transparent secondary window (`snipper`).
  - Eliminates main window hide/restore cycles, DWM DirectComposition redraw flash, and Acrylic recreation flicker.
  - Zero residue: ensures crosshair overlays and post-recording blur backdrops cleanly unmount without intercepting desktop mouse clicks or resurfacing on subsequent triggers.
- **Companion Tandem Workflows & Subprocess Isolation (`cathet.rs`, `cathet-service.js`, `ocr-service.js`, `external_launch.rs`, `alitken-service.js`)**:
  - **Cathet Glass Scratchpad Tandem**: OCR text handoff via temporary markdown payload dispatching directly to Cathet (`Cathet.exe`).
  - **Alitken Video Companion Tandem**: Deep-link bridge allowing one-click transfer of active images and captured snips to Alitken for advanced editing and seamless auto-reload in Bukaake upon save.
  - **Subprocess Environment Isolation Protocol**: Both companion launchers explicitly purge Bukaake's internal Chromium flags (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` and `WEBVIEW2_USER_DATA_FOLDER`) and anchor the child `current_dir` to the companion executable directory. This eliminates WebView2 argument mismatch conflicts on shared User Data Folders (`com.cathet.app\EBWebView`), ensuring companion windows open cleanly without deadlocks even when already running prior to Bukaake.
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

### Precision Crop, Drawing, Blur & Editing Exclusivity
- **Precision Crop (`cropper.js`, `crop-snapping.js`, `crop.css`)**:
  - Dual-stroke sandwich contrast layering (1px core flanked by dark casing shadows) guarantees visibility on pure white or pure black photos.
  - Magnetic laser guides detect image edges and centers with dynamic snapping.
- **Drawing Tool (`drawing-tool.js`, `draw.css`)**:
  - Screen-to-image coordinate mapping (`screenToImageCoords`), strokes clipped strictly to image bounds (`ctx.clip()`), discrete undo stack (`Ctrl+Z`).
  - **Tri-State Auto-Smooth & Axis Constraints (`stroke-smoother.js`)**: Cycles `Off â†’ Natural â†’ Galaxy` via `S` (`localStorage`: `bukaake-draw-auto-smooth`). Galaxy mode applies 24px macro-stride decimation, 3-pass Chaikin B-Spline subdivision, and calligraphic tapered ribbon rendering with rounded dome caps; `Shift`/`Ctrl` enforce horizontal/vertical axis constraints when Auto-Smooth is Off.
- **Blur & Pixelate Tool (`blur-tool.js`, `blur-renderer.js`, `blur-toolbar.js`)**:
  - Activated via `U` with freehand Brush, Rectangle, and Circle shapes, Low/Med/High intensity presets, Feather Edge toggle, brush size slider (`10pxâ€“150px`), and per-stroke non-stacking offscreen caching.
- **In-Tool Contextual Shortcut HUD (`tool-hud.js`, `tool-hud.css`)**:
  - Non-closable stroke-free glass shortcut guidance anchored at equal `20px` corner insets (`top: calc(var(--titlebar-height, 42px) + 20px)` in Mode 1, `top: 20px` in Mode 2), collapsible to a transparent glowing outline `ri-error-warning-line` beacon, with anti-stacking offset (`left: 356px`) when `metadata-drawer.js` is open.
- **Tool Exclusivity (`canvas-tools-manager.js`)**:
  - Crop (`C`), Draw (`D`), Blur & Pixelate (`U`), Text (`T`), and Color Adjustments (`E`) are mutually exclusive; activating any tool locks out context menus, directory navigation, and file deletion.
  - **Layered `Escape` & Editing Expansion**: `CanvasToolsManager.handleEscape()` closes open tool popovers first and exits only the active editor without closing the image. Entering any of the 5 editors in Mode 1 expands the window to `1280 Ã— 720` (clamped to screen work area) and restores pre-edit dimensions on exit.
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
  - Settings About tab and main settings modal feature direct links to the official website ([bukaake.kaleksananbagus.com](https://bukaake.kaleksananbagus.com)), GitHub repository, and community support channels (Saweria and Ko-fi at `https://ko-fi.com/curlyzed`).
  - Elevated contrast for version tag chips in dark mode (`--text-main` over `--glass-btn-hover-bg`).
- **Tray Standby & Universal Idle Memory Reclaim Coordinator (`reclaim.rs`, `process_memory.rs`, `standby.rs`, `standby-service.js`, `snipper-app.js`, `settings-app.js`)**:
  - Persistent background tray daemon coordinating idle working set memory reclamation across the Rust host and all descendant `msedgewebview2.exe` processes down to **~15â€“20 MB total tree Working Set** (~13 MB private). Left-click on tray restores window cleanly into Mode 1.
  - **Universal Tray Hooking**: Centralized in `request_idle_reclaim()`, automatically triggered whenever the app enters an idle hidden state: main window close/hide, snip finish/cancel (`finish_screen_snip`), recording pill exit (`exit_recording_pill_mode`), settings modal/window close, and autostart settle.
  - **Two-Stage Delayed Trim Architecture**: Broadcasts the native `bukaake://reclaim` event across webview runtimes to release DOM image caches and trigger Chromium V8 GC (`window.gc?.()`). Executes primary Win32 `trim_process_tree()` (`K32EmptyWorkingSet` across all tree PIDs) at **+1.5s**, followed by a secondary trim at **+5.5s** to capture delayed DWM / DirectX GPU swapchain deallocations.
  - **Atomic Generation Cancellation (`RECLAIM_GEN`)**: User interaction, window wake, or capture tool activations increment the atomic generation counter, instantly aborting pending background reclaim jobs to guarantee zero hot-path latency.
  - **Autostart Settle Loop (`--startup`)**: When launched minimized on Windows boot, monitors tree working set delta every 3 seconds (< 3MB delta threshold) before scheduling reclaim, eliminating the 90â€“100MB startup spike down to ~15â€“20MB without requiring manual window toggling.
  - **Zero Hardcoded Centering Invariant**: Never invoke `win.center()` on window close, hide, or tray wake. Always preserve user window position and multi-monitor coordinates.
  - **Clean Standby Hide Invariant**: In `enter_standby`, only invoke `win.hide()`. Never apply `set_size` or repositioning during hide, as Win32/Tauri renders moves before completing the hide, causing an unsightly screen jump/flash glitch.
  - **Startup Window Size Lock & WS_THICKFRAME Invariant**: Empty/drop-zone startup dimensions and minimum bounds are locked to `680Ã—480`, while Mode 1 dynamically enforces `740Ã—520` minimum bounds when an image is loaded. **Never call `set_resizable(false)` natively on Windows**. In Windows 11 DWM, stripping `WS_THICKFRAME` forces DWM to draw an active 1px white border around frameless windows and removes rounded corners/shadows. Window size locking on startup is enforced via DOM handle suppression (`body:not(.image-loaded) .resize-handle { display: none !important; }`), while fixed dialogs (Settings) use native Win32 `WM_NCHITTEST` subclassing (`window_subclass.rs`) to remap edge hit-tests to `HTCLIENT` and block `SC_SIZE` modal loops, keeping `resizable: true` (`WS_THICKFRAME`) active so borders remain completely eliminated and corners stay rounded without resize flicker.
- **Mode 1 â†” Mode 2 FLIP Transitions & Pre-Flight Bootstrapper (`window_transition.rs`, `mode-transition.js`, `transition-card.js`, `foreground.rs`, `bootstrapper.rs`)**:
  - Uses DWM cloaking, atomic geometry/acrylic commits, and a stroke-free glass transition shell for smooth Mode 1 â†” Mode 2 (`Maximized` default vs `Fullscreen` presentation style) FLIP morphing and Explorer single-instance reveal (`ASFW_ANY` + `AttachThreadInput`).
  - `.cargo/config.toml` enables static CRT linking (`+crt-static`), and `bootstrapper.rs` verifies Windows 10 (1809+) and WebView2 Evergreen Runtime availability on launch.
  - **Win32 Titlebar Maximize Interception Invariant**: The main window subclasses `WM_NCLBUTTONDBLCLK` and `SC_MAXIMIZE` in `window_subclass.rs` to intercept titlebar double-clicks and DWM maximize requests, routing them smoothly via the `bukaake-toggle-mode` event directly into Mode 2 transparent fullscreen without DWM maximize flash or Acrylic recreation flicker.
  - **Return-to-Start Brand Button & Window Reset**: The titlebar app icon converts to an interactive back button (`ri-arrow-left-line`) with cross-fade on hover in Mode 1 when an image is loaded. Clicking checks `changeTracker.hasUnsavedChanges()` before triggering the confirmation dialog, clears the active image, and resets/centers the window dimensions back to the default 680Ã—480 start state.
  - **Empty State Aspect Isolation**: In `window-mode-manager.js`, `resizeAndCenter` is strictly guarded by `if (this.viewer?.img && this.lastAspectSize)`. `handleEmptyState()` must always clear `this.windowModeManager.lastAspectSize = null`.
- **Microsoft Store & Desktop Bridge MSIX Packaging (`scripts/package-msix.ps1`, `packaging/`, `package_info.rs`)**:
  - Automated packaging pipeline generating signed and unsigned `.msix` Desktop Bridge bundles from release binaries and `package.json` version metadata.
  - Populates `AppxManifest.template.xml` from `packaging/store-config.json`, registering 49 declarative file associations.
  - Runtime environment detection via Win32 `GetCurrentPackageFamilyNameW` (`package_info.rs`) suppresses the GitHub Releases in-app self-updater in favor of Windows Store background update channels.
- **Shell File Association (`file_assoc.rs`, `file-assoc-service.js`)**:
  - Registers ProgID and capabilities for 49 formats under `HKCU` (zero UAC prompts).
  - Silent auto-healing on startup checks binary location and updates registry commands in-place if executable is moved.
- **Internationalization (i18n) & Multi-Language Subsystem (`i18n-service.js`, `manifest.js`, `src/locales/`)**:
  - Zero-dependency micro-i18n engine with 5 dictionaries (`en.json`, `id.json`, `jv-ngoko.json`, `jv-krama.json`, `jv-malangan.json`) bundled directly into the Vite binary payload, maintaining 100% portable single-executable architecture, plus `scripts/i18n-tool.js` for bi-directional translation templates.
  - Multi-attribute DOM batch engine: automatically hydrates `[data-i18n]` (textContent), `[data-i18n-title]` (titles & tooltips), and `[data-i18n-placeholder]` (input placeholders).
  - Fallback chaining (`activeLocale` -> `en` -> `rawKey`) and runtime parameter interpolation (`{key}`).
  - Cross-window live synchronization: coordinates instant live hot-swapping across main viewer, settings, and transparent snipper overlay windows via `localStorage` storage events and Tauri IPC without window reloads.
  - First-class support for English (`en`), Indonesian (`id`), Javanese Ngoko (`jv-ngoko`), Javanese Krama (`jv-krama`), and Javanese Malangan (`jv-malangan`).
  - Community Translations: Standardized contributor guide via `CONTRIBUTING_TRANSLATIONS.md`.

---

## 4. Development & Build Rules

### Agent Output Protocol & Workspace Hygiene

- **Artifact Isolation Protocol**: **ALL planning, analysis, release note drafts, behaviour descriptions, and architectural decisions MUST be written directly into the active task artifact file** in the designated IDE artifact directory (`<appDataDir>\brain\<conversation-id>`). Chat responses may only contain a 1-3 sentence pointer to the artifact plus any open questions.
- **Zero Artifact Littering Policy**: **Agents must NEVER litter the project workspace with temporary artifacts, drafts, scratch notes, or release note markdown files** (e.g. `RELEASE_NOTES_*.md`, plan docs). The project repository must remain strictly clean and contain only production codebase files, official repository docs (`README.md`, `AGENTS.md`, `history.md`), and build assets.

### Project Memory & Documentation Protocol (`history.md`)

- **Mandatory Pre-Planning Check**: Before making ANY plan, architectural decision, or code modification, agents **MUST** view and inspect [history.md](file:///e:/Default/DEVS/Bukaake/history.md). Review the logged mistakes and user corrections to guarantee no previous mistakes are repeated.
- **Change Logging ("The Gist of It")**: Every time agents modify code across the project, write a concise entry into `history.md` summarizing the changes, affected files, and rationale.
- **Mistake & Correction Logging**: When the user corrects an agent (e.g., *"don't do this"*, *"this isn't like what I expected"*, *"I never told you to do this"*), the agent **MUST immediately record the mistake** in `history.md` tagged as `[MISTAKE]` and `[CORRECTION]`, explaining what was wrong, why it was wrong, and the strict prevention rule.

### Strict Release Notes Protocol

Whenever the user asks to generate or draft release notes:
- **Strict Artifact Placement**: **NEVER write release note documents in the project repository folder**. Always write them inside the task artifact directory (`<appDataDir>\brain\<conversation-id>\release_notes_v<version>.md`).
- **Zero Blockquotes Policy**: **NEVER use `>` markdown quote blocks** in release notes because they degrade formatting aesthetics.
- **Zero Download Links Policy**: **DO NOT include any download links**.
- **Zero Repetition Policy**: **NEVER include any change or bug fix that was already covered in prior release notes**. Strictly document novel changes since the previous release tag (`git log <prev_tag>..HEAD --oneline`).
- **Dual-Audience Tone (Casual Summary + Technical Details)**:
  - **Summary**: Write for casual / non-pro users using brief, engaging README-style bullet points with feature icons (`🔒`, `✨`, `💡`, etc.) highlighting everyday benefits in plain language (no internal file names or engineering jargon).
  - **Target & Detailed Changes**: Use strictly professional, factual, and objective technical language with **zero emojis** and no hype. More technical depth is better (APIs, synchronization mechanics, GPU blits, Win32 hooks, memory bounds).
- **Mandatory 4-Part Structure**:
  1. **Title** (`# Bukaake vX.Y.Z Release Notes`)
  2. **Target** (project, version/baseline tag, platform, scope)
  3. **Summary** (casual/non-pro README-style bullet points with feature icons)
  4. **Detailed Changes** (what changed, why the change was made, bug fixes, technical details, and covered commits)

### Fast Validation Commands
- `npm run dev` â€” Launch Vite dev server on port 3000.
- `npm run tauri:dev` â€” Launch Tauri v2 desktop app in development mode.
- `npm run build` â€” Fast production bundle check for frontend assets.
- `cargo check --manifest-path src-tauri/Cargo.toml` â€” Fast backend type-check.
- `npm run bump` â€” Atomically synchronize version across `package.json`, `Cargo.toml`, and `tauri.conf.json`.

### Grouped Staging & Commit Workflow

Whenever the user asks for a commit message, to commit changes, or when handling commits across multiple modified/untracked files:
1. **Inspect Waiting List / Untracked Files**: Check current `git status` and inspect the specific changes (`git diff`) in each file.
2. **Group Files by Category & Similarity**: Group related files into logical batches based on their domain and scope (e.g., Group 1: Frontend UI/styling components; Group 2: Native Rust backend/capture; Group 3: Documentation/configuration).
3. **Stage Files by Group**: For each group, stage only its matching files using `git add <files>`.
4. **Structured Group Commit Message**:
   - Specific per-file line item documenting changes in each file.
   - Broader commit message documenting the commit batch context and overarching purpose.
5. **Autonomous Commit Execution**: Run `git commit -m "..."` for each group so the user does not have to type it manually. The user will inspect the completed commits afterwards.

### Compilation Invariant
- **No Automatic Production Binary Builds**: Agents must **NEVER** run `cargo build --release` or `npm run tauri:build` autonomously after completing tasks. Full compilation is exclusively initiated by the user or via the root control center (`run.bat` / `run.ps1`).
- **Universal Rule â€” Never Assume, Always Ask**: If user requirements or aesthetic nuances are ambiguous, agents must ask clarifying questions before committing changes.

