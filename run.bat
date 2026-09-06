@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Bukaake — Desktop Image Viewer Manager
cd /d "%~dp0"

set CARGO_BUILD_JOBS=1

:MENU
cls
echo.
echo  ======================================================================
echo    Bukaake — Transparent Desktop Viewer Control Center
echo  ======================================================================

:: Extract current version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /i "\"version\":" package.json') do (
    set "CURRENT_VER=%%~a"
)
if "%CURRENT_VER%"=="" set "CURRENT_VER=1.0.0"

echo    Current Version: v%CURRENT_VER%
echo  ======================================================================
echo.
echo    [1] Live Dev: Native Desktop Window (Tauri Live Dev ^& Hot-Reload)
echo    [2] Live Dev: Instant Web/Edge Window (Fast UI Preview)
echo    [3] Build Production x64 App (Smallest Size -^> release-builds/)
echo    [4] Build Production ARM64 App (Smallest Size -^> release-builds/)
echo    [5] Build Both Architectures (x64 + ARM64)
echo    [6] Bump Version (Patch, Minor, Major, or Custom)
echo    [7] Quick Run: Latest Compiled Release Executable
echo    [8] Clean Build Artifacts ^& Locks
echo    [9] Exit
echo.
set /p CHOICE="  Select an option [1-9]: "

if "%CHOICE%"=="1" goto DEV_TAURI
if "%CHOICE%"=="2" goto DEV_WEB
if "%CHOICE%"=="3" goto BUILD_X64
if "%CHOICE%"=="4" goto BUILD_ARM64
if "%CHOICE%"=="5" goto BUILD_BOTH
if "%CHOICE%"=="6" goto BUMP_VER
if "%CHOICE%"=="7" goto RUN_RELEASE
if "%CHOICE%"=="8" goto CLEAN_CACHE
if "%CHOICE%"=="9" goto EXIT_APP
goto MENU

:STOP_LOCKS
taskkill /F /IM cargo.exe /IM rustc.exe /IM bukaake.exe 2>nul
taskkill /F /FI "IMAGENAME eq bukaake*" 2>nul
exit /b 0

:DEV_TAURI
echo.
echo  [+] Cleaning background locks...
call :STOP_LOCKS
if not exist "node_modules" call npm install
echo  [+] Launching Live Hot-Reloading Tauri Window...
call npx tauri dev -- -j 1
pause
goto MENU

:DEV_WEB
echo.
echo  [+] Starting preview server ^& opening Edge standalone window...
start "" "msedge.exe" --app="http://localhost:3000/?sample=true" --window-size=1100,720
call npx vite --port 3000 --host
pause
goto MENU

:BUILD_X64
echo.
echo  ======================================================================
echo    Compiling Ultra-Compact x64 Release (v%CURRENT_VER%)
echo  ======================================================================
call :STOP_LOCKS
if not exist "node_modules" call npm install
if not exist "release-builds" mkdir release-builds

echo  [1/3] Bundling and minifying frontend assets...
call npm run build
if errorlevel 1 ( echo [-] Frontend build failed! & pause & goto MENU )

echo  [2/3] Compiling Rust release binary (opt-level=z, LTO, strip, abort)...
cargo build --release --manifest-path src-tauri/Cargo.toml
if errorlevel 1 ( echo [-] Rust build failed! & pause & goto MENU )

echo  [3/3] Packaging into release-builds/...
set "OUT_FILE=release-builds\bukaake-v%CURRENT_VER%-x64.exe"
copy /y "src-tauri\target\release\bukaake.exe" "%OUT_FILE%" >nul

for %%I in ("%OUT_FILE%") do set "SIZE_BYTES=%%~zI"
set /a SIZE_MB=%SIZE_BYTES% / 1048576
set /a SIZE_KB=(%SIZE_BYTES% %% 1048576) / 1024

echo.
echo    [+] Successfully compiled: %OUT_FILE%
echo    [+] File Size: %SIZE_MB% MB (%SIZE_KB% KB)
echo.
pause
goto MENU

:BUILD_ARM64
echo.
echo  ======================================================================
echo    Compiling Ultra-Compact ARM64 Release (v%CURRENT_VER%)
echo  ======================================================================
call :STOP_LOCKS
if not exist "node_modules" call npm install
if not exist "release-builds" mkdir release-builds

echo  [+] Ensuring rustup ARM64 target is installed...
call rustup target add aarch64-pc-windows-msvc

echo  [1/3] Bundling frontend assets...
call npm run build
if errorlevel 1 ( echo [-] Frontend build failed! & pause & goto MENU )

echo  [2/3] Cross-compiling for Windows on ARM64...
cargo build --release --target aarch64-pc-windows-msvc --manifest-path src-tauri/Cargo.toml
if errorlevel 1 ( echo [-] ARM64 build failed! & pause & goto MENU )

echo  [3/3] Packaging into release-builds/...
set "OUT_FILE=release-builds\bukaake-v%CURRENT_VER%-arm64.exe"
copy /y "src-tauri\target\aarch64-pc-windows-msvc\release\bukaake.exe" "%OUT_FILE%" >nul

for %%I in ("%OUT_FILE%") do set "SIZE_BYTES=%%~zI"
set /a SIZE_MB=%SIZE_BYTES% / 1048576
set /a SIZE_KB=(%SIZE_BYTES% %% 1048576) / 1024

echo.
echo    [+] Successfully compiled: %OUT_FILE%
echo    [+] File Size: %SIZE_MB% MB (%SIZE_KB% KB)
echo.
pause
goto MENU

:BUILD_BOTH
call :BUILD_X64
call :BUILD_ARM64
goto MENU

:BUMP_VER
echo.
echo  ======================================================================
echo    Bukaake Version Manager  (Current: v%CURRENT_VER%)
echo  ======================================================================
echo    [1] Patch (e.g. 1.0.0 -^> 1.0.1)
echo    [2] Minor (e.g. 1.0.0 -^> 1.1.0)
echo    [3] Major (e.g. 1.0.0 -^> 2.0.0)
echo    [4] Custom Version String
echo    [5] Cancel
echo.
set /p BUMP_CHOICE="  Select bump type [1-5]: "

if "%BUMP_CHOICE%"=="1" node scripts/bump-version.js patch & pause & goto MENU
if "%BUMP_CHOICE%"=="2" node scripts/bump-version.js minor & pause & goto MENU
if "%BUMP_CHOICE%"=="3" node scripts/bump-version.js major & pause & goto MENU
if "%BUMP_CHOICE%"=="4" (
    set /p CUSTOM_VER="  Enter new version string: "
    node scripts/bump-version.js !CUSTOM_VER!
    pause
    goto MENU
)
goto MENU

:RUN_RELEASE
set "TARGET_EXE=release-builds\bukaake-v%CURRENT_VER%-x64.exe"
if not exist "%TARGET_EXE%" set "TARGET_EXE=src-tauri\target\release\bukaake.exe"
if not exist "%TARGET_EXE%" set "TARGET_EXE=src-tauri\target\debug\bukaake.exe"

if not exist "%TARGET_EXE%" (
    echo [-] No compiled executable found! Please compile with Option [3] first.
    pause
    goto MENU
)
echo [+] Launching: %TARGET_EXE%
start "" "%TARGET_EXE%"
goto MENU

:CLEAN_CACHE
echo.
echo  [+] Cleaning build artifacts and locks...
call :STOP_LOCKS
cargo clean --manifest-path src-tauri/Cargo.toml
if exist "dist" rmdir /s /q dist
echo  [+] Clean complete!
pause
goto MENU

:EXIT_APP
exit /b 0
