# Bukaake v1.0.0 — The Desktop Immersion & High-Throughput Engine Release

**The ultra-fast, transparent, and distraction-free photo viewer for Windows.**  
*Reviving the desktop-immersive magic of Google Picasa Photo Viewer with modern stroke-free frosted glass.*

---

## 🌟 What's New in v1.0.0 (Since v0.9.0)

### 1. 🖼️ Native Desktop Wallpaper Integration
Set any active image or processed canvas export as your Windows desktop wallpaper directly from the canvas:
- **Native Win32 Wallpaper Engine (`wallpaper.rs`)**: Direct wallpaper application using Windows `SystemParametersInfoW` (`SPI_SETDESKWALLPAPER`, `SPIF_UPDATEINIFILE | SPIF_SENDCHANGE`) without third-party tools or external processes.
- **Canvas & Edits Wallpaper Caching**: When applying wallpaper from an edited image (crops, freehand drawings, color adjustments, text annotations) or non-native formats, Bukaake automatically renders the processed canvas to a cached high-quality PNG in `%APPDATA%\Bukaake\bukaake_wallpaper.png` before updating the desktop.
- **Transcoding Fallback**: Native Windows wallpaper APIs natively accept standard formats (`.jpg`, `.jpeg`, `.png`, `.bmp`). Non-standard and VFX formats (`.webp`, `.avif`, `.tiff`, `.hdr`, etc.) are automatically transcoded to PNG in the background, eliminating the Windows grey desktop wallpaper glitch.
- **Intelligent Context Menu Gating**: The "Set as Desktop Wallpaper" action in the stroke-free context menu is automatically enabled for standard image types or for any loaded image once edits are applied.

### 2. ⚡ Non-Blocking Binary RAW Pipeline & Zero-Base64 IPC
Full-sensor RAW decode (`Q` key / context menu) has been transformed from a main-thread base64 transfer into an ultra-fast binary streaming pipeline:
- **Zero-Base64 Binary IPC (`read_raw_full_sensor_binary`)**: Rust backend directly streams raw JPEG bytes via `tauri::ipc::Response::new(bytes)`, eliminating megabytes of string allocation, garbage collection spikes, and Base64 encoding overhead across the Tauri IPC bridge.
- **Asynchronous Rust I/O (`spawn_blocking`)**: Heavy disk I/O, directory scanning, and LibRaw sensor unpack are offloaded to dedicated blocking thread pools, preventing UI hitches or Tauri executor stalls during multi-megapixel RAW file reads.
- **Off-Thread Browser Rasterization**: The frontend `RawLoadController` and `file-loader.js` leverage HTMLImageElement `img.decode()` off the main thread prior to rendering, delivering silky smooth transitions.

### 3. 💫 Titlebar Ambient Glowing Loading Beam
- **Atmospheric Progress Beam (`titlebar-loader.js`, `titlebar-loader.css`)**: Background decodes (such as full sensor Bayer demosaicing) now display a glowing, stroke-free dual-train progress beam across the bottom edge of the titlebar.
- **Dual-Train Stream Animation**: Features continuous gradient light beams (`#38bdf8` to `#818cf8` in Obsidian Dark, `#2563eb` to `#3b82f6` in Slate Light) with ambient drop glow.
- **Mode 2 Seamless Elevation**: In Mode 2 Transparent Fullscreen, the glowing beam smoothly elevates to the absolute top edge of the monitor screen (`top: 0`, full viewport width).
- **Smooth Emerald Completion Flash**: Flashes an emerald green highlight (`#34d399`) upon completion before smoothly cross-fading away.
- **Steady Titlebar Anchor**: While active, the titlebar remains visible without flickering or shifting controls.

### 4. 🧭 Session Token Cancellation & Race Condition Immunity
- **Monotonic Session Tracking (`loadSessionId`)**: Rapidly navigating images (via Arrow keys, batch jumping, or mouse wheel) assigns a monotonic session token to every decode task.
- **Stale Decode Discarding**: Slower background decode jobs from previously viewed images are immediately discarded upon arrival if the user has already navigated away, preventing stale images from overwriting newer views.
- **Automatic Object URL Cleanup**: Memory leaks are eliminated by revoking previous Blob Object URLs immediately upon cancellation or reload.

### 5. 🪟 Explorer Launch Placement & Mode 2 Stability
- **Minimized Launch Recovery**: Resolves an issue where double-clicking images in Windows Explorer while Bukaake was minimized or running in tray standby failed to enter Fullscreen Mode. Window placement is restored via `unminimize()` prior to fullscreen transition.
- **`isPendingPathLoad` Guard**: Protects `WindowModeManager` state checking during initial image path IPC transfer, preventing premature fullscreen teardown during window resize events.

### 6. 🌐 Official Resources Portal & UI Contrast Polish
- **Settings & Modal Resource Links**: Added frosted glass action buttons linking directly to the official website ([bukaake.kaleksananbagus.com](https://bukaake.kaleksananbagus.com)) and the GitHub Repository ([github.com/Crlyzd/Bukaake](https://github.com/Crlyzd/Bukaake)).
- **Dark Mode Contrast Calibration**: Elevated `.version-tag` chip contrast in the Settings About view to `--text-main` over translucent glass hover backing, and fine-tuned `.app-version` typography.
- **Robust Version Bump Script (`bump-version.js`)**: Updated path resolution to match domain-driven submodules, ensuring synchronized version management.

---

## 📋 Commits Included in v1.0.0 (Since v0.9.0)

| Commit | Scope | Description |
| :--- | :--- | :--- |
| `86a26dd` | `feat(viewer)` | Add desktop wallpaper context action and fix minimized launch fullscreen |
| `14fb949` | `feat(settings)` | Add website and GitHub repository resource links |
| `fd70cfe` | `refactor(backend)` | Extract neighbor_scanner module for directory traversal |
| `4225f05` | `refactor(backend)` | Export neighbor_scanner module in imaging |
| `2b662b3` | `feat(imaging)` | Add decode_raw_full_sensor_bytes for direct binary JPEG output |
| `99e1c43` | `feat(imaging)` | Offload file reads to spawn_blocking and add read_raw_full_sensor_binary |
| `10e8ebb` | `feat(ipc)` | Register read_raw_full_sensor_binary command in main.rs |
| `979ed12` | `feat(bridge)` | Add readRawFullSensorBinary IPC wrapper |
| `5ff198a` | `feat(viewer)` | Add session token cancellation on navigation and off-thread image decoding |
| `f4ca27d` | `feat(ui)` | Add TitlebarLoader component for glowing progress beam lifecycle |
| `cac976d` | `feat(services)` | Add RawLoadController for non-blocking binary RAW decode and titlebar beam integration |
| `2286a73` | `feat(styles)` | Add dual-theme glowing titlebar loading beam with continuous dual-train animation |
| `5ee6153` | `style` | Import titlebar-loader.css in main design system |
| `3816888` | `feat(dom)` | Add titlebarLoadingBeam element for ambient loading beam |
| `a046fb0` | `feat(app)` | Integrate RawLoadController into main application coordinator |
| `5a8b05e` | `fix(scripts)` | Resolve path drift in bump-version for modular architecture |
| `da75829` | `style(ui)` | Improve app version chip contrast in dark mode |
| `9e25469` | `chore(release)` | Synchronize application version to 1.0.0 |
