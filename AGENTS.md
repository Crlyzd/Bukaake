# Bukaake — Project Agent Guidelines & Architecture Manual

> **Bukaake**: A high-performance, lightweight, and portable Windows image viewer built with Rust, Tauri v2, and modern Vanilla Web technologies, reviving the beloved, fluid, and desktop-immersive experience of the classic **Google Picasa Photo Viewer**.

---

## 1. Core Architectural Pillars

Every agent (Architect, Coding Specialist, Code Reviewer, Orchestrator) working on this repository **MUST** strictly adhere to and enforce these five non-negotiable architectural pillars:

### Pillar 1: Modern Stroke-Free Glassmorphism Design System
All visual components must follow a cohesive, ultra-sleek, stroke-free frosted glass aesthetic:
- **Materials**: Use `backdrop-filter: blur(20px) saturate(180%)` with translucent RGBA/HSLA background fills.
- **Zero Lines / Strokes Policy**: **Never use 1px border strokes, lines, or specular highlight outlines** on windows, floating toolbars, buttons, cards, or dialogs. Visual boundary and depth are created exclusively through translucent frosted glass fills and soft, multi-layered ambient drop shadows (`box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5)`).
- **Seamless Spacing Dividers**: Never use solid 1px divider lines or strokes between button groups; use transparent spacing margins (`width: 5px; background: transparent;`).
- **Controls**: Floating pill toolbars, rounded glass cards (`border-radius: 8px` to `9999px`), frameless titlebar ghost buttons, and smooth micro-interactions (spring hover scale, active depression).
- **Typography & Icons**: Inter for UI, JetBrains Mono for metadata/coordinates. All UI icons **MUST** be **minimalist monochrome SVGs** (clean, razor-sharp single-color vector graphics that inherit `currentColor` to adapt dynamically across dark and light glass themes; never use multi-colored, bitmap, or raster icons). **Zero Emojis Policy**: Never use colorful system/Unicode emojis (e.g., ❤️, ☕, 🚀) or raw text arrow symbols (e.g., ↗) in UI markup or component templates; always use crisp monochrome vector SVG icons.
- **Zero Monolithic / Plain Components**: Never use unstyled browser defaults or flat, opaque gray boxes for buttons, dropdowns, inputs, or toolbars.

### Pillar 2: Dual Theme Engine (Dark & Light)
The application must provide first-class support for both Dark and Light themes:
- **Design Tokens**: All styling must strictly utilize CSS custom properties defined in the design token system:
  - `--glass-bg`: Frosted background fill (Deep obsidian `rgba(6, 7, 10, 0.92)` in dark vs `rgba(255, 255, 255, 0.65)` in light).
  - `--glass-border`: Set to `transparent` (zero stroke lines).
  - `--glass-panel-bg`: Surface fill for window and panels (`rgba(2, 3, 5, calc(0.68 + var(--window-opacity) * 0.32))` in dark vs `rgba(244, 246, 249, ...)` in light).
  - `--text-main`, `--text-muted`, `--text-dim`: High-contrast accessible text colors.
  - `--action-bg`, `--action-text`: Monochrome action button fills.
- **Deep Obsidian Dark Mode**: Dark mode must be deeply dark, never washed-out blue or gray.
- **Zero Pure Black in Light Mode Policy**: **Never use pure pitch black (`#000000`, `#0a0a0a`, `#111111`, or raw `rgba(0, 0, 0, ...)`) in Light Mode** across any UI elements (action button fills, active preset chips, slider thumbs, text, icons, borders, or shadows). All dark accents, active buttons, slider thumbs, and primary text in Light Mode MUST use the refined dark obsidian slate tone derived from the Dark Mode setting card (`#242938` / `#2a3142`, with translucent alphas anchored to `rgba(26, 32, 44, ...)`). This ensures controls and typography remain modern, soft, and cohesive without harsh inky contrast.
- **No Hardcoded Hex Colors**: Hardcoded color literals in component CSS or inline styles are prohibited.
- **Native Acrylic Tint Coordination**: The Rust backend applies native Windows Acrylic blur in coordination with the active theme (`Some((0, 0, 0, 248))` for dark, `Some((245, 247, 250, 130))` for light).
- **Theme Switching**: Instant, flicker-free theme switching with persistence in local storage and automatic system preference detection (`prefers-color-scheme`).

### Pillar 3: GitHub Releases Auto-Updater
The application must be able to self-update from its GitHub repository releases:
- **Tauri v2 Updater**: Powered by `@tauri-apps/plugin-updater` and `tauri-plugin-updater`.
- **Release Feed Endpoint**: `https://github.com/<owner>/bukaake/releases/latest/download/latest.json`.
- **Updater Experience**:
  - Background silent check on application launch.
  - Non-intrusive glass notification pill/toast when an update is available.
  - Interactive updater modal displaying new version number, changelog/release notes, download progress bar, and "Restart & Install" action.
  - Manual "Check for Updates" trigger in Titlebar / Help modal.
  - Resilient offline error handling (no blocking error dialogs if network is unavailable).

### Pillar 4: Dual-Mode & Picasa-Style Transparent Viewing
Reliving the iconic Google Picasa Photo Viewer experience with two tailored modes:
- **Mode 1: Regular App Mode (`body.mode-regular`)**:
  - Centered aspect-ratio window with docked frameless titlebar and native Windows acrylic blur.
  - Smooth window resizing with proportional aspect fitting and edge handles.
- **Mode 2: Fullscreen Image Viewer Mode (`body.mode-viewer`)**:
  - **Strictly transparent with lowered brightness and NO blur**: Windows Acrylic blur is cleared via `clear_acrylic(&main_win)` and CSS blur is removed (`backdrop-filter: brightness(0.60)`). The desktop wallpaper remains visible behind the image without harsh/distracting blur.
  - **CRITICAL IMMERSION INVARIANT — Never Alter Mode 2**: Fullscreen Image Viewer Mode (`body.mode-viewer`) MUST ALWAYS remain strictly transparent with lowered brightness (60%) and zero blur. Any changes to tokens, frosted glass, card styles, window acrylic, or settings windows MUST NEVER introduce blur, opacity, or borders to Mode 2.
  - Borderless maximization over the desktop (`decorations: false`, `transparent: true`).
- **Picasa Idle Mouse Fade**:
  - When an image is displayed and the mouse is stationary for 2.5 seconds, all UI chrome (titlebar, floating pill toolbar, badges) fades smoothly to `opacity: 0` (`pointer-events: none`).
  - As soon as the user moves the mouse, controls instantly fade back in.
- **Navigation & Canvas Ergonomics**:
  - High-performance 60 FPS HTML5 Canvas pan and zoom.
  - Smooth mouse wheel zoom anchored to cursor coordinates.
  - Arrow keys (Left/Right) for instant navigation across neighbor images in the current folder.
  - Quick keys: `F` (Fit to screen), `1` (100% 1:1 Actual size), `Esc` (Exit fullscreen / Close), `C` (Crop), `E` (Filters), `I` (Metadata).

### Pillar 5: Strict Modularity Architecture (No Monoliths)
- **Hard Rule — Maximum 300 Lines Per File**: No source code file (`.js`, `.css`, `.rs`) may exceed **300 lines of code**. Any file approaching this limit must be proactively refactored into focused submodules.
- **Single Responsibility Principle**: Each file must do one thing well:
  - UI components manage only DOM rendering and user interaction events.
  - Services handle external concerns (Tauri IPC, updater, filesystem, shortcuts, window modes).
  - Core engines handle computation and canvas rendering.
- **Never Dump Code into `app.js` or `style.css`**: Feature additions must create dedicated, importable modules.

---

## 2. Directory Structure & Module Standards

```
bukaake/
├── .agents/
│   └── workflows/             # Specialized Agent Workflows
│       ├── orchestrator.md    # Multi-phase task coordinator
│       ├── architect.md       # Planning & system design
│       ├── coding-specialist.md # Code executor
│       └── code-reviewer.md   # Quality & 5-pillar auditor
├── AGENTS.md                  # Authoritative project rules manual
├── package.json
├── index.html                 # Main viewer entrypoint
├── settings.html              # Dedicated standalone settings window
├── src/
│   ├── components/            # Isolated UI modules (< 250 lines each)
│   │   ├── titlebar.js        # Window controls, filename badge, image dimensions
│   │   ├── toolbar.js         # Responsive floating control dock (< 200 lines)
│   │   ├── adjustments-panel.js # Color sliders, preset chips
│   │   ├── metadata-drawer.js # EXIF, file size, dimensions drawer
│   │   ├── shortcuts-modal.js # Keyboard shortcuts overlay
│   │   ├── updater-modal.js   # Glass GitHub release update dialog
│   │   └── toast.js           # Translucent toast notifications
│   ├── core/                  # Core canvas & image math engines
│   │   ├── canvas-viewer.js   # 60fps pan/zoom canvas engine
│   │   ├── cropper.js         # Interactive crop overlay engine
│   │   ├── filters.js         # Color adjustment processor
│   │   └── metadata.js        # EXIF parser & dimension reader
│   ├── services/              # External & platform services (< 200 lines each)
│   │   ├── tauri-bridge.js    # Tauri v2 window, args, fs IPC wrapper
│   │   ├── window-mode-manager.js # Regular mode vs Fullscreen viewer mode coordinator
│   │   ├── updater.js         # GitHub release auto-updater service
│   │   ├── theme-manager.js   # Dark & light theme switcher + acrylic tint
│   │   ├── file-loader.js     # Image file loader, drag & drop, clipboard
│   │   ├── shortcuts.js       # Keyboard hotkeys registry
│   │   └── idle-controller.js # Picasa-style idle mouse fade controller
│   ├── styles/                # Modular CSS design system (< 200 lines each)
│   │   ├── tokens.css         # Stroke-free glass tokens (dark & light)
│   │   ├── base.css           # Typography, reset, viewport layout
│   │   ├── glass.css          # Core glassmorphism classes & ambient shadows
│   │   ├── main.css           # Master stylesheet bundling component submodules
│   │   └── components/        # Component-specific styles
│   │       ├── titlebar.css   # Frameless ghost titlebar
│   │       ├── toolbar.css    # Responsive floating control dock
│   │       ├── crop.css       # Crop tool overlay & controls
│   │       ├── modes.css      # Mode 1 regular vs Mode 2 fullscreen viewer
│   │       ├── settings.css   # Standalone settings window styling
│   │       └── toast.css      # Translucent toast styling
│   ├── app.js                 # Main window bootstrap coordinator (< 120 lines)
│   └── settings-app.js        # Standalone settings window coordinator (< 100 lines)
└── src-tauri/
    ├── Cargo.toml             # Tauri v2 dependencies (`window-vibrancy 0.6.0`)
    ├── tauri.conf.json        # Multi-window config (main + settings)
    └── src/
        ├── main.rs            # Native acrylic vibrancy + window IPC commands
        └── image_loader.rs    # Fast native image decoding & metadata reading
```

---

## 3. Technology Stack & Commands

| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Desktop Framework** | Tauri v2 | `@tauri-apps/cli` ^2.0.0, `tauri` ^2.0.0 |
| **Backend Language** | Rust | Edition 2021 |
| **Windows Acrylic** | `window-vibrancy` | 0.6.0 (`apply_acrylic`, `clear_acrylic`) |
| **Auto-Updater** | Tauri Updater Plugin | `@tauri-apps/plugin-updater`, `tauri-plugin-updater` |
| **Frontend Bundler** | Vite | ^5.4.0 (Multi-page ES Modules: `index.html`, `settings.html`) |
| **Frontend Core** | Vanilla JavaScript | ES6+ Modules, No Heavy Frameworks |
| **Styling** | Vanilla CSS | Stroke-free Glassmorphism, CSS Custom Properties |
| **Icons** | Minimalist Monochrome SVG | Clean vector icons (Monochrome inline SVGs / Remix Icons, `currentColor`) |
| **Typography** | Inter & JetBrains Mono | Google Fonts |

### Common CLI Commands
- `npm run dev` — Launch Vite local dev server (port 3000)
- `npm run tauri:dev` — Launch Tauri v2 desktop application in development mode
- `npm run build` — Compile production Vite bundle
- `npm run tauri:build` — Build standalone portable Windows release executable

### Compilation Rule
- **No Automatic Production Binary Builds**: Agents must **NOT** automatically compile the full desktop application (`cargo build --release` / `tauri build`) once a task is finished. Use fast validation (`npm run build` for frontend bundle and `cargo check` for Rust type-checking). Full binary compilation is reserved for when the user explicitly requests it or executes it via `run.bat` / `run.ps1`.

---

## 4. Agent Role & Execution Guidelines

1. **Architect (`/architect`)**:
   - Performs deep analysis of current codebase.
   - Outputs implementation plans adhering to the 5 Pillars (including Stroke-Free Glass and Mode 2 Zero-Blur).
   - Enforces file size budgets (< 300 lines) and explicit modular breakdowns.
   - Does NOT write final implementation code.

2. **Coding Specialist (`/coding-specialist`)**:
   - Implements features strictly matching architectural specifications.
   - Never creates monolithic files or adds bloat to existing files.
   - Builds UI using stroke-free glassmorphism tokens and classes (no 1px borders).
   - Ensures all UI functions seamlessly in both deep dark and light themes.
   - Integrates Tauri v2 APIs and multi-window IPC cleanly.

3. **Code Reviewer (`/code-reviewer`)**:
   - Audits code against the **Bukaake 5-Pillar Checklist**:
     1. Stroke-Free Glassmorphism styling validated (no border strokes or 1px dividing lines).
     2. Dual-theme compatibility verified (deep obsidian dark mode, no hardcoded colors).
     3. Auto-updater hooks verified for safety and resilience.
     4. Mode transitions verified (regular mode acrylic vs fullscreen viewer strictly transparent with zero blur).
     5. Strict modularity check: **Instantly reject any file exceeding 300 lines.**

4. **Orchestrator (`/orchestrator`)**:
   - Breaks down multi-step tasks into clear, atomic specialist subtasks.
   - Tracks execution progress across Architect, Coding Specialist, and Code Reviewer.
   - Ensures quality handoffs and synthesizes results for the user.

5. **Universal Rule — Never Assume, Always Ask**:
   - Agents MUST NEVER assume the user's aesthetic, functional, or architectural intentions when an instruction or design nuance is subjective, ambiguous, or underspecified.
   - If user intent is unclear or open to interpretation, agents MUST actively ask clarifying questions before committing changes.
