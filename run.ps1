# ==============================================================================
# Bukaake — Windows Desktop Viewer Control Center (PowerShell)
# ==============================================================================

$Host.UI.RawUI.WindowTitle = "Bukaake — Desktop Image Viewer Manager"
Set-Location -Path $PSScriptRoot
$env:CARGO_BUILD_JOBS = "1"

function Get-AppVersion {
    if (Test-Path "package.json") {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        return $pkg.version
    }
    return "1.0.0"
}

function Show-Header {
    param([string]$version)
    Clear-Host
    Write-Host ""
    Write-Host "  ======================================================================" -ForegroundColor Cyan
    Write-Host "    Bukaake — Transparent Desktop Viewer Control Center [v$version]" -ForegroundColor BrightWhite
    Write-Host "  ======================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Format-FileSize {
    param([string]$filePath)
    if (Test-Path $filePath) {
        $bytes = (Get-Item $filePath).Length
        $mb = [Math]::Round($bytes / 1MB, 2)
        $kb = [Math]::Round($bytes / 1KB, 1)
        return "$mb MB ($kb KB)"
    }
    return "N/A"
}

function Stop-Locks {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { 
        $_.ProcessName -like "*bukaake*" -or $_.ProcessName -in @("cargo", "rustc", "tauri") 
    } | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Invoke-BuildX64 {
    param([string]$version)
    Write-Host "`n  ======================================================================" -ForegroundColor Cyan
    Write-Host "    Compiling Ultra-Compact x64 Release (v$version)" -ForegroundColor BrightWhite
    Write-Host "  ======================================================================" -ForegroundColor Cyan
    Stop-Locks
    if (-not (Test-Path "release-builds")) { New-Item -ItemType Directory -Path "release-builds" | Out-Null }

    Write-Host "  [1/3] Bundling and minifying frontend assets..." -ForegroundColor Yellow
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) { Write-Host "[-] Frontend build failed!" -ForegroundColor Red; return $false }

    Write-Host "  [2/3] Compiling Rust release binary (opt-level=z, LTO, strip, abort)..." -ForegroundColor Yellow
    cmd /c "cargo build --release --manifest-path src-tauri/Cargo.toml"
    if ($LASTEXITCODE -ne 0) { Write-Host "[-] Rust build failed!" -ForegroundColor Red; return $false }

    $outFile = "release-builds\bukaake-v$version-x64.exe"
    Copy-Item -Path "src-tauri\target\release\bukaake.exe" -Destination $outFile -Force
    $sizeStr = Format-FileSize -filePath $outFile

    Write-Host "`n  [+] Successfully compiled: $outFile" -ForegroundColor Green
    Write-Host "  [+] Executable File Size: $sizeStr`n" -ForegroundColor BrightGreen
    return $true
}

function Invoke-BuildArm64 {
    param([string]$version)
    Write-Host "`n  ======================================================================" -ForegroundColor Cyan
    Write-Host "    Compiling Ultra-Compact ARM64 Release (v$version)" -ForegroundColor BrightWhite
    Write-Host "  ======================================================================" -ForegroundColor Cyan
    Stop-Locks
    if (-not (Test-Path "release-builds")) { New-Item -ItemType Directory -Path "release-builds" | Out-Null }

    Write-Host "  [+] Verifying rustup ARM64 target..." -ForegroundColor Yellow
    cmd /c "rustup target add aarch64-pc-windows-msvc"

    Write-Host "  [1/3] Bundling frontend assets..." -ForegroundColor Yellow
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) { Write-Host "[-] Frontend build failed!" -ForegroundColor Red; return $false }

    Write-Host "  [2/3] Cross-compiling for Windows on ARM64..." -ForegroundColor Yellow
    cmd /c "cargo build --release --target aarch64-pc-windows-msvc --manifest-path src-tauri/Cargo.toml"
    if ($LASTEXITCODE -ne 0) { Write-Host "[-] ARM64 build failed!" -ForegroundColor Red; return $false }

    $outFile = "release-builds\bukaake-v$version-arm64.exe"
    Copy-Item -Path "src-tauri\target\aarch64-pc-windows-msvc\release\bukaake.exe" -Destination $outFile -Force
    $sizeStr = Format-FileSize -filePath $outFile

    Write-Host "`n  [+] Successfully compiled: $outFile" -ForegroundColor Green
    Write-Host "  [+] Executable File Size: $sizeStr`n" -ForegroundColor BrightGreen
    return $true
}

while ($true) {
    $currentVer = Get-AppVersion
    Show-Header -version $currentVer

    Write-Host "    [1] Live Dev: Native Desktop Window (Tauri Live Dev & Hot-Reload)" -ForegroundColor Yellow
    Write-Host "    [2] Live Dev: Instant Web/Edge Window (Fast UI Preview)" -ForegroundColor DarkYellow
    Write-Host "    [3] Build Production x64 App (Smallest Size -> release-builds/)" -ForegroundColor Green
    Write-Host "    [4] Build Production ARM64 App (Smallest Size -> release-builds/)" -ForegroundColor Green
    Write-Host "    [5] Build Both Architectures (x64 + ARM64)" -ForegroundColor BrightGreen
    Write-Host "    [6] Bump Version (Patch / Minor / Major / Custom)" -ForegroundColor Magenta
    Write-Host "    [7] Quick Run: Latest Compiled Release Executable" -ForegroundColor Cyan
    Write-Host "    [8] Clean Build Artifacts & Locks" -ForegroundColor Gray
    Write-Host "    [9] Exit" -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host "  Select an option [1-9]"

    switch ($choice) {
        "1" {
            Write-Host "`n  [+] Cleaning background locks..." -ForegroundColor Yellow
            Stop-Locks
            if (-not (Test-Path "node_modules")) {
                Write-Host "  [+] Installing dependencies..." -ForegroundColor Yellow
                cmd /c "npm install"
            }
            Write-Host "  [+] Launching Live Hot-Reloading Tauri Window..." -ForegroundColor Green
            cmd /c "npx tauri dev -- -j 1"
            Read-Host "`n  Press Enter to return to menu..."
        }
        "2" {
            Write-Host "`n  [+] Launching Standalone Edge UI Preview..." -ForegroundColor Yellow
            Start-Process "msedge.exe" -ArgumentList "--app=http://localhost:3000/?sample=true --window-size=1100,720"
            cmd /c "npx vite --port 3000 --host"
            Read-Host "`n  Press Enter to return to menu..."
        }
        "3" {
            Invoke-BuildX64 -version $currentVer
            Read-Host "  Press Enter to return to menu..."
        }
        "4" {
            Invoke-BuildArm64 -version $currentVer
            Read-Host "  Press Enter to return to menu..."
        }
        "5" {
            Invoke-BuildX64 -version $currentVer
            Invoke-BuildArm64 -version $currentVer
            Read-Host "  Press Enter to return to menu..."
        }
        "6" {
            Write-Host "`n  ======================================================================" -ForegroundColor Cyan
            Write-Host "    Bukaake Version Manager  (Current: v$currentVer)" -ForegroundColor BrightWhite
            Write-Host "  ======================================================================" -ForegroundColor Cyan
            Write-Host "    [1] Patch (e.g. 1.0.0 -> 1.0.1)" -ForegroundColor Yellow
            Write-Host "    [2] Minor (e.g. 1.0.0 -> 1.1.0)" -ForegroundColor Yellow
            Write-Host "    [3] Major (e.g. 1.0.0 -> 2.0.0)" -ForegroundColor Yellow
            Write-Host "    [4] Custom Version String" -ForegroundColor Yellow
            Write-Host "    [5] Cancel" -ForegroundColor Gray
            Write-Host ""

            $bumpType = Read-Host "  Select bump type [1-5]"
            switch ($bumpType) {
                "1" { cmd /c "node scripts/bump-version.js patch"; Read-Host }
                "2" { cmd /c "node scripts/bump-version.js minor"; Read-Host }
                "3" { cmd /c "node scripts/bump-version.js major"; Read-Host }
                "4" {
                    $custom = Read-Host "  Enter custom version (e.g. 1.0.5)"
                    cmd /c "node scripts/bump-version.js $custom"
                    Read-Host
                }
            }
        }
        "7" {
            $targetExe = "release-builds\bukaake-v$currentVer-x64.exe"
            if (-not (Test-Path $targetExe)) { $targetExe = "src-tauri\target\release\bukaake.exe" }
            if (-not (Test-Path $targetExe)) { $targetExe = "src-tauri\target\debug\bukaake.exe" }

            if (Test-Path $targetExe) {
                Write-Host "`n  [+] Launching: $targetExe" -ForegroundColor Green
                Start-Process $targetExe
            } else {
                Write-Host "`n  [-] No compiled executable found! Please build with Option [3] first." -ForegroundColor Red
                Read-Host
            }
        }
        "8" {
            Write-Host "`n  [+] Cleaning build artifacts and locks..." -ForegroundColor Yellow
            Stop-Locks
            cmd /c "cargo clean --manifest-path src-tauri/Cargo.toml"
            if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
            Write-Host "  [+] Clean complete!`n" -ForegroundColor Green
            Read-Host "  Press Enter to return to menu..."
        }
        "9" {
            exit 0
        }
    }
}
