# Bukaake — Project Agent Guidelines & Architecture Manual

> **Bukaake**: A high-performance, lightweight, and portable Windows image viewer built with Rust, Tauri v2, and modern Vanilla Web technologies, reviving the beloved, fluid, and desktop-immersive experience of the classic **Google Picasa Photo Viewer**.

---

## 1. Core Architectural Pillars

Every agent (Architect, Coding Specialist, Code Reviewer, Orchestrator) working on this repository **MUST** strictly adhere to and enforce these five non-negotiable architectural pillars:

### Pillar 1: Modern Glassmorphism Design System
All visual components must follow a cohesive, ultra-sleek, frosted glass aesthetic:
- **Materials**: Use `backdrop-filter: blur(20px) saturate(180%)` with translucent RGBA/HSLA background fills.
- **Borders & Highlights**: Subtle 1px specular borders (`rgba(255, 255, 255, 0.12)` in dark, `rgba(0, 0, 0, 0.08)` in light) with delicate top-edge specular highlights.
- **Shadows**: Multi-layered soft ambient drop shadows and subtle inner glows (`box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)`).
- **Controls**: Floating pill toolbars, rounded glass cards (`border-radius: 12px` to `9999px`), frosted modal dialogs, and smooth micro-interactions (spring hover scale, active depression).
- **Typography & Icons**: Inter for UI, JetBrains Mono for metadata/coordinates. All UI icons **MUST** be **minimalist monochrome SVGs** (clean, razor-sharp single-color vector graphics that inherit `currentColor` to adapt dynamically across dark and light glass themes; never use multi-colored, bitmap, or raster icons).
- **Zero Monolithic / Plain Components**: Never use unstyled browser defaults or flat, opaque gray boxes for buttons, dropdowns, inputs, or toolbars.

### Pillar 2: Dual Theme Engine (Dark & Light)
The application must provide first-class support for both Dark and Light themes:
- **Design Tokens**: All styling must strictly utilize CSS custom properties defined in the design token system:
  - `--glass-bg`: Frosted background fill (`rgba(18, 20, 26, 0.65)` dark vs `rgba(245, 247, 250, 0.72)` light).
  - `--glass-border`: Translucent boundary (`rgba(255, 255, 255, 0.12)` dark vs `rgba(0, 0, 0, 0.08)` light).
  - `--glass-panel`: Surface fill for floating panels and drawers.
  - `--text-primary`, `--text-secondary`, `--text-muted`: High-contrast accessible text colors.
  - `--accent-color`, `--accent-glow`: Electric cyan/teal accent for active states.
- **No Hardcoded Hex Colors**: Hardcoded color literals in component CSS or inline styles are prohibited.
- **Native Acrylic Tint Coordination**: The Rust backend adjusts the Windows acrylic blur tint color in coordination with the active theme (`(15, 15, 20, 10)` for dark, `(240, 243, 248, 120)` for light).
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

### Pillar 4: Picasa-Style Borderless Transparent Viewing
Reliving the iconic Google Picasa Photo Viewer experience:
- **Borderless & Transparent**: Window runs with `decorations: false` and `transparent: true`.
- **Desktop Immersion on Image Open**: When an image is opened, the window immediately maximizes borderless over the desktop, applying a frosted translucent acrylic blur so the desktop wallpaper remains subtly visible behind the viewing canvas.
- **Picasa Idle Mouse Fade**:
  - When the image is displayed and the mouse is stationary for 2.5 seconds, all UI chrome (titlebar, floating pill toolbar, badges) fades smoothly to `opacity: 0` (`pointer-events: none`).
  - As soon as the user moves the mouse, the controls instantly fade back in.
- **Navigation & Canvas Ergonomics**:
  - High-performance 60 FPS HTML5 Canvas pan and zoom.
  - Smooth mouse wheel zoom anchored to cursor coordinates.
  - Arrow keys (Left/Right) for instant navigation across neighbor images in the current folder.
  - Quick keys: `F` (Fit to screen), `1` (100% 1:1 Actual size), `Esc` (Exit fullscreen / Close), `C` (Crop), `E` (Filters), `I` (Metadata).

### Pillar 5: Strict Modularity Architecture (No Monoliths)
- **Hard Rule — Maximum 300 Lines Per File**: No source code file (`.js`, `.css`, `.rs`) may exceed **300 lines of code**. Any file approaching this limit must be proactively refactored into focused submodules.
- **Single Responsibility Principle**: Each file must do one thing well:
  - UI components manage only DOM rendering and user interaction events.
  - Services handle external concerns (Tauri IPC, updater, filesystem, shortcuts).
  - Core engines handle computation and canvas rendering.
- **Never Dump Code into `app.js` or `style.css`**: Feature additions must create dedicated, importable modules.

---

## 2. Directory Structure & Module Standards

```
e:/Default/DEVS/Bukaake/
├── .agents/
│   └── workflows/             # Specialized Agent Workflows
│       ├── orchestrator.md    # Multi-phase task coordinator
│       ├── architect.md       # Planning & system design
│       ├── coding-specialist.md # Code executor
│       └── code-reviewer.md   # Quality & 5-pillar auditor
├── AGENTS.md                  # This file: authoritative project rules
├── package.json
├── index.html
├── src/
│   ├── components/            # Isolated Glassmorphism UI modules (< 250 lines)
│   │   ├── titlebar.js        # Window controls, filename badge, image dimensions
│   │   ├── toolbar.js         # Floating glass pill toolbar
│   │   ├── adjustments-panel.js # Color sliders, preset chips
│   │   ├── metadata-drawer.js # EXIF, file size, dimensions drawer
│   │   ├── shortcuts-modal.js # Keyboard shortcuts overlay
│   │   ├── updater-modal.js   # Glass GitHub release update dialog
│   │   └── toast.js           # Translucent toast notifications
│   ├── core/                  # Core canvas & image engines
│   │   ├── canvas-viewer.js   # 60fps pan/zoom canvas engine
│   │   ├── cropper.js         # Interactive crop overlay
│   │   ├── filters.js         # Color adjustment processor
│   │   └── metadata.js        # EXIF parser & dimension reader
│   ├── services/              # External & platform services (< 200 lines)
│   │   ├── tauri-bridge.js    # Tauri v2 window, args, fs IPC wrapper
│   │   ├── updater.js         # GitHub release auto-updater service
│   │   ├── theme-manager.js   # Dark & light theme switcher + acrylic tint
│   │   ├── file-loader.js     # Image file loader, drag & drop, clipboard
│   │   ├── shortcuts.js       # Keyboard hotkeys registry
│   │   └── idle-controller.js # Picasa-style idle mouse fade controller
│   ├── styles/                # Modular CSS design system (< 250 lines each)
│   │   ├── tokens.css         # Glass tokens for dark and light themes
│   │   ├── base.css           # Typography, reset, viewport layout
│   │   ├── glass.css          # Glassmorphism utilities, shadows, blur
│   │   └── components/        # Component-specific styles
│   └── app.js                 # Lean coordinator bootstrapping all modules (< 120 lines)
└── src-tauri/
    ├── Cargo.toml             # Tauri v2 dependencies & updater plugin
    ├── tauri.conf.json        # Transparent borderless window + updater endpoints
    └── src/
        └── main.rs            # Windows acrylic vibrancy + updater plugin init
```

---

## 3. Technology Stack & Commands

| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Desktop Framework** | Tauri v2 | `@tauri-apps/cli` ^2.0.0, `tauri` ^2.0.0 |
| **Backend Language** | Rust | Edition 2021 |
| **Windows Acrylic** | `window-vibrancy` | 0.5.0 (`apply_acrylic`) |
| **Auto-Updater** | Tauri Updater Plugin | `@tauri-apps/plugin-updater`, `tauri-plugin-updater` |
| **Frontend Bundler** | Vite | ^5.4.0 (ES Modules) |
| **Frontend Core** | Vanilla JavaScript | ES6+ Modules, No Heavy Frameworks |
| **Styling** | Vanilla CSS | CSS Custom Properties, Glassmorphism, BEM |
| **Icons** | Minimalist Monochrome SVG | Clean vector icons (Remix Icons SVG/vector, monochrome, `currentColor`) |
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
   - Outputs implementation plans adhering to the 5 Pillars.
   - Enforces file size budgets (< 300 lines) and explicit modular breakdowns.
   - Does NOT write final implementation code.

2. **Coding Specialist (`/coding-specialist`)**:
   - Implements features strictly matching architectural specifications.
   - Never creates monolithic files or adds bloat to existing files.
   - Builds UI using glassmorphism tokens and classes.
   - Ensures all UI functions seamlessly in both Dark and Light themes.
   - Integrates Tauri v2 APIs cleanly.

3. **Code Reviewer (`/code-reviewer`)**:
   - Audits code against the **Bukaake 5-Pillar Checklist**:
     1. Glassmorphism styling validated (no flat/un-blurred elements).
     2. Dual-theme compatibility verified (no hardcoded colors).
     3. Auto-updater hooks verified for safety and resilience.
     4. Picasa borderless transparent maximization & idle fade verified.
     5. Strict modularity check: **Instantly reject any file exceeding 300 lines.**

4. **Orchestrator (`/orchestrator`)**:
   - Breaks down multi-step tasks into clear, atomic specialist subtasks.
   - Tracks execution progress across Architect, Coding Specialist, and Code Reviewer.
   - Ensures quality handoffs and synthesizes results for the user.
