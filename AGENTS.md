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
- **Single Responsibility Principle**: Each file must do one thing well:
  - UI components manage only DOM rendering and user interaction events.
  - Services handle external concerns (Tauri IPC, updater, filesystem, shortcuts, window modes, change tracking, image saving).
  - Core engines handle computation, drawing, filters, and canvas rendering.
- **Never Dump Code into `app.js` or `style.css`**: Feature additions must create dedicated, importable modules.

---

## 2. Directory Structure & Module Standards

All 43 source files in the project strictly respect the < 300 lines per file budget:

```
bukaake/
├── .agents/
│   └── workflows/                 # Specialized Agent Workflows
│       ├── orchestrator.md        # Multi-phase task coordinator (~50 lines)
│       ├── architect.md           # Planning & system design (~65 lines)
│       ├── coding-specialist.md   # Code executor (~75 lines)
│       └── code-reviewer.md       # Quality & 5-pillar auditor (~70 lines)
├── AGENTS.md                      # Authoritative project rules manual
├── package.json
├── index.html                     # Main viewer entrypoint
├── settings.html                  # Dedicated standalone settings window
├── scripts/
│   └── bump-version.js            # Atomic version synchronizer across json/toml (~70 lines)
├── src/
│   ├── components/                # Isolated UI modules (< 250 lines each)
│   │   ├── adjustments-panel.js   # Color sliders, preset chips (~115 lines)
│   │   ├── confirm-modal.js       # Unsaved changes confirmation dialog (~70 lines)
│   │   ├── context-menu.js        # Glass desktop right-click context menu (~195 lines)
│   │   ├── metadata-drawer.js     # EXIF, file size, dimensions drawer (~40 lines)
│   │   ├── settings-modal.js      # Glass settings & updater modal overlay (~95 lines)
│   │   ├── shortcuts-modal.js     # Keyboard shortcuts cheat sheet (~40 lines)
│   │   ├── titlebar.js            # Window controls, filename badge, image info (~155 lines)
│   │   ├── toast.js               # Single-toast lifecycle notification pill (~40 lines)
│   │   └── toolbar.js             # Responsive floating control dock & draw popover (~245 lines)
│   ├── core/                      # Core canvas, drawing & image math engines (< 260 lines each)
│   │   ├── canvas-events.js       # Pan/zoom mouse & drag event handler (~105 lines)
│   │   ├── canvas-helpers.js      # Coordinate transforms & math utilities (~55 lines)
│   │   ├── canvas-viewer.js       # 60fps pan/zoom canvas engine & fit logic (~250 lines)
│   │   ├── cropper.js             # Interactive crop overlay engine (~240 lines)
│   │   ├── drawing-tool.js        # Freehand pen, highlighter, cursor ring & baking (~260 lines)
│   │   ├── filters.js             # Color adjustment processor (~95 lines)
│   │   └── metadata.js            # EXIF parser & dimension reader (~60 lines)
│   ├── services/                  # External & platform services (< 300 lines each)
│   │   ├── change-tracker.js      # Unsaved edits state tracking (~50 lines)
│   │   ├── file-loader.js         # Image file loader, drag & drop, clipboard (~265 lines)
│   │   ├── idle-controller.js     # Picasa-style idle mouse fade controller (~105 lines)
│   │   ├── image-saver.js         # Tauri & web image saving, copy to clipboard (~100 lines)
│   │   ├── shortcuts.js           # Keyboard hotkeys registry (~145 lines)
│   │   ├── tauri-bridge.js        # Tauri v2 window, args, fs IPC wrapper (~295 lines)
│   │   ├── theme-manager.js       # Dark & light theme switcher + acrylic tint (~85 lines)
│   │   ├── updater-service.js     # GitHub releases updater & multi-window sync (~175 lines)
│   │   └── window-mode-manager.js # Regular vs Fullscreen mode coordinator (~125 lines)
│   ├── styles/                    # Modular CSS design system (< 240 lines each)
│   │   ├── base.css               # Typography, reset, SVG checkerboard (~110 lines)
│   │   ├── glass.css              # Core glassmorphism classes & ambient shadows (~200 lines)
│   │   ├── main.css               # Master stylesheet bundling component submodules (~20 lines)
│   │   ├── tokens.css             # Stroke-free glass tokens (dark & light) (~110 lines)
│   │   └── components/            # Component-specific stylesheets
│   │       ├── confirm-modal.css  # Unsaved changes glass confirmation dialog (~150 lines)
│   │       ├── context-menu.css   # Glass context menu with high-contrast backing (~100 lines)
│   │       ├── crop.css           # Crop tool overlay & controls (~225 lines)
│   │       ├── draw.css           # Floating drawing toolbar & popover styling (~195 lines)
│   │       ├── modes.css          # Mode 1 regular vs Mode 2 fullscreen viewer (~230 lines)
│   │       ├── panels.css         # Adjustments, metadata, and glass pill buttons (~220 lines)
│   │       ├── settings.css       # Standalone settings window & modal styling (~225 lines)
│   │       ├── shortcuts.css      # Keyboard shortcuts modal styling (~60 lines)
│   │       ├── titlebar.css       # Frameless ghost titlebar & disabled states (~235 lines)
│   │       ├── toast.css          # Stroke-free floating glass toast pill (~50 lines)
│   │       ├── toolbar.css        # Responsive floating control dock (~170 lines)
│   │       └── vibrancy.css       # Window vibrancy & background layer overrides (~70 lines)
│   ├── app.js                     # Main window bootstrap coordinator (~295 lines)
│   └── settings-app.js            # Standalone settings window coordinator (~115 lines)
└── src-tauri/
    ├── Cargo.toml                 # Tauri v2 dependencies (`window-vibrancy`, `rfd`, `image`, `arboard`)
    ├── tauri.conf.json            # Multi-window config (main + settings)
    └── src/
        ├── main.rs                # Native acrylic vibrancy + window IPC commands (~275 lines)
        ├── image_loader.rs        # Fast native image decoding & metadata reading (~205 lines)
        ├── clipboard.rs           # Native OS clipboard engine, CF_HDROP & image IPC (~165 lines)
        └── updater.rs             # Native in-place self-updater, progress & relaunch (~170 lines)
```

---

## 3. Technology Stack & Commands

| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Desktop Framework** | Tauri v2 | `@tauri-apps/cli` ^2.0.0, `tauri` ^2.0.0 |
| **Backend Language** | Rust | Edition 2021 |
| **Windows Acrylic** | `window-vibrancy` | 0.6.0 (`apply_acrylic`, `clear_acrylic`) |
| **Native Dialogs** | `rfd` | 0.15 (Native file open and save dialogs) |
| **Image Processing** | `image` | 0.25 (Fast native decoding, EXIF orientation, thumbnailing) |
| **Clipboard Engine** | `arboard` & Win32 APIs | 3.4 (`CF_HDROP`, `CF_DIB`, zero browser permission prompts) |
| **Auto-Updater** | Custom GitHub Service | `src/services/updater-service.js` querying GitHub Releases API |
| **Frontend Bundler** | Vite | ^5.4.0 (Multi-page ES Modules: `index.html`, `settings.html`) |
| **Frontend Core** | Vanilla JavaScript | ES6+ Modules, No Heavy Frameworks |
| **Styling** | Vanilla CSS | Stroke-free Glassmorphism, CSS Custom Properties |
| **Icons** | Remix Icons & Monochrome SVG | Clean vector icons (`ri-*` classes, `currentColor`) |
| **Typography** | Inter & JetBrains Mono | Google Fonts |

### Common CLI Commands
- `npm run dev` — Launch Vite local dev server (port 3000)
- `npm run tauri:dev` — Launch Tauri v2 desktop application in development mode
- `npm run build` — Compile production Vite bundle
- `npm run tauri:build` — Build standalone portable Windows release executable
- `npm run bump` — Atomically bump version across `package.json`, `Cargo.toml`, and `tauri.conf.json`

### Compilation Rule
- **No Automatic Production Binary Builds**: Agents must **NOT** automatically compile the full desktop application (`cargo build --release` / `tauri build`) once a task is finished. Use fast validation (`npm run build` for frontend bundle and `cargo check` for Rust type-checking). Full binary compilation is reserved for when the user explicitly requests it or executes it via `run.bat` / `run.ps1`.

---

## 4. Subsystem Architectures

### Native OS Clipboard Subsystem
- **Core Native Engine (`src-tauri/src/clipboard.rs`)**:
  - Completely eliminates WebView2 browser permission popups (`http://tauri.localhost wants to...`) by managing clipboard operations directly via native Windows OS APIs.
  - Supports Windows File Explorer clipboard files (`CF_HDROP`), extracting image file paths and automatically indexing folder siblings for Left/Right arrow navigation.
  - Decodes raster clipboard images (`CF_DIB`) via `arboard`, serializing to PNG base64 data URLs for seamless viewer loading.
  - Provides native clipboard image writing for `Ctrl+C` and processed image exports.
- **Frontend IPC Integration (`src/services/tauri-bridge.js`, `src/services/file-loader.js`, `src/services/image-saver.js`)**:
  - `tauriBridge.readClipboard()` and `writeClipboardImage()` invoke native backend commands with graceful web fallbacks.
  - Direct `Ctrl+V` and titlebar paste triggers protected by `confirmModal.promptIfDirty()`.

### Interactive Drawing & Highlighting Subsystem
- **Core Tool (`src/core/drawing-tool.js`)**:
  - Operates on a dedicated overlay canvas synchronized to viewport size.
  - Supports two primary drawing modes: `pen` (sharp, opaque, round joins) and `highlighter` (40% translucent, wide chisel stroke).
  - Maintains a discrete stroke stack enabling full Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`).
  - Transforms viewport screen coordinates to image-space coordinates via `canvasViewer.screenToImageCoords`.
  - Strictly clips all strokes to image dimensions (`ctx.clip()`) to prevent bleed.
  - Supports non-destructive drawing overlay and permanent baking via `bakeToImage()` onto an offscreen canvas.
- **UI & Popover (`src/styles/components/draw.css`, `src/components/toolbar.js`)**:
  - Tool popover docked to toolbar with stroke widths (8px, 16px, 24px, 32px, 48px) and curated vibrant palette.
  - Custom dynamic cursor ring (`#drawCursorRing`) reflecting pen stroke size in real time.

### Change Tracking & Safe Export Lifecycle
- **Change Tracker (`src/services/change-tracker.js`)**:
  - Tracks dirty status across Crop, Color adjustments, and Drawing.
  - Explicitly ignores pure viewport transforms (rotation, flipping, pan, zoom) per design pillars.
  - Broadcasts dirty state changes to listeners.
- **Unsaved Changes Dialog (`src/components/confirm-modal.js`, `src/styles/components/confirm-modal.css`)**:
  - Guards destructive actions (opening another image, navigating to neighbor image, closing window).
  - Offers "Save", "Discard", or "Cancel" actions with keyboard focus.
- **Image Saver (`src/services/image-saver.js`)**:
  - Exports combined canvas with active filters applied and formatted date-time stamp.
  - In Tauri: invokes native `prompt_save_file` via `rfd` and writes binary bytes via `save_image_bytes`.
  - In Web: supports `showSaveFilePicker` and anchor fallback.
  - Supports instant clipboard copying of processed images via `copyProcessedImage` (routed through native `writeClipboardImage` in Tauri).

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

