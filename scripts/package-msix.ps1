# ==============================================================================
# Bukaake - Microsoft Store MSIX & MSIXBundle Packaging Pipeline
# Automates layout staging, manifest templating, MakeAppx packing and bundling (< 250 lines)
# ==============================================================================

param(
    [string]$ConfigPath = "packaging\store-config.json",
    [string]$VersionOverride = "",
    [switch]$SkipBuild,
    [string]$Arch = "all",
    [switch]$SignDev
)

Set-Location -Path (Join-Path $PSScriptRoot "..")

function Get-AppVersion {
    if ($VersionOverride) { return $VersionOverride }
    if (Test-Path "package.json") {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        return $pkg.version
    }
    return "1.0.0"
}

function Format-4PartVersion {
    param([string]$ver)
    $clean = $ver.TrimStart('v')
    $parts = $clean.Split('.')
    while ($parts.Count -lt 4) { $parts += "0" }
    return ($parts[0..3] -join '.')
}

function Find-SdkTool {
    param([string]$toolName)
    $kitsDir = "C:\Program Files (x86)\Windows Kits\10\bin"
    if (-not (Test-Path $kitsDir)) { return $null }
    $found = Get-ChildItem -Path $kitsDir -Filter $toolName -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -like "*\x64\*" } |
        Sort-Object { $_.Directory.Parent.Name } -Descending |
        Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

$makeAppx = Find-SdkTool "makeappx.exe"
if (-not $makeAppx) {
    Write-Error "[-] makeappx.exe not found! Please install the Windows 10/11 SDK."
    exit 1
}

if (-not (Test-Path $ConfigPath)) {
    Write-Error "[-] Store configuration file not found at: $ConfigPath"
    exit 1
}

$storeCfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$semVer = Get-AppVersion
$appxVer = Format-4PartVersion $semVer

Write-Host ""
Write-Host "  ======================================================================" -ForegroundColor Cyan
Write-Host "    Bukaake Microsoft Store MSIX Packaging Pipeline [v$semVer ($appxVer)]" -ForegroundColor White
Write-Host "  ======================================================================" -ForegroundColor Cyan
Write-Host "    Publisher ID:   $($storeCfg.publisherId)" -ForegroundColor DarkGray
Write-Host "    Package Name:   $($storeCfg.packageName)" -ForegroundColor DarkGray
Write-Host "    MakeAppx Tool:  $makeAppx" -ForegroundColor DarkGray
Write-Host ""

# 1. Verify or trigger asset generation
$assetsDir = "packaging\msix\Assets"
if (-not (Test-Path (Join-Path $assetsDir "StoreLogo.png"))) {
    Write-Host "  [+] Generating required Store visual assets..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File "scripts\generate-store-assets.ps1"
}

# 2. Compile binaries if needed
if (-not $SkipBuild) {
    if ($Arch -in @("all", "x64")) {
        Write-Host "  [+] Compiling production x64 binary..." -ForegroundColor Yellow
        cmd /c "npm run build"
        cmd /c "cargo build --release --manifest-path src-tauri/Cargo.toml"
        if ($LASTEXITCODE -ne 0) { Write-Error "[-] x64 Rust compilation failed!"; exit 1 }
        if (-not (Test-Path "release-builds")) { New-Item -ItemType Directory -Path "release-builds" | Out-Null }
        Copy-Item "src-tauri\target\release\bukaake.exe" "release-builds\bukaake-v$semVer-x64.exe" -Force
    }
    if ($Arch -in @("all", "arm64")) {
        Write-Host "  [+] Compiling production ARM64 binary..." -ForegroundColor Yellow
        cmd /c "cargo build --release --target aarch64-pc-windows-msvc --manifest-path src-tauri/Cargo.toml"
        if ($LASTEXITCODE -eq 0) {
            Copy-Item "src-tauri\target\aarch64-pc-windows-msvc\release\bukaake.exe" "release-builds\bukaake-v$semVer-arm64.exe" -Force
        } else {
            Write-Warning "[!] ARM64 compilation skipped or failed. Continuing with available builds."
        }
    }
}

# 3. Prepare Staging Directory
$stagingRoot = "staging\msix"
if (Test-Path $stagingRoot) { Remove-Item -Recurse -Force $stagingRoot }
New-Item -ItemType Directory -Path "$stagingRoot\bundles" -Force | Out-Null

$manifestTemplate = Get-Content "packaging\msix\AppxManifest.template.xml" -Raw

function Invoke-StageAndPackArch {
    param([string]$targetArch, [string]$binaryPath)
    if (-not (Test-Path $binaryPath)) {
        Write-Warning "[-] Binary for $targetArch not found at $binaryPath. Skipping."
        return $null
    }

    $archStaging = "$stagingRoot\$targetArch"
    New-Item -ItemType Directory -Path "$archStaging\Assets" -Force | Out-Null
    Copy-Item "$binaryPath" "$archStaging\bukaake.exe" -Force
    Copy-Item "$assetsDir\*" "$archStaging\Assets" -Recurse -Force

    $manifest = $manifestTemplate `
        -replace '\{\{PACKAGE_NAME\}\}', $storeCfg.packageName `
        -replace '\{\{PUBLISHER_ID\}\}', $storeCfg.publisherId `
        -replace '\{\{PUBLISHER_DISPLAY_NAME\}\}', $storeCfg.publisherDisplayName `
        -replace '\{\{VERSION\}\}', $appxVer `
        -replace '\{\{ARCH\}\}', $targetArch

    Set-Content -Path "$archStaging\AppxManifest.xml" -Value $manifest -Encoding UTF8

    $outMsix = "$stagingRoot\bundles\Bukaake_${appxVer}_${targetArch}.msix"
    Write-Host "  [+] Packing $targetArch MSIX: $outMsix" -ForegroundColor Yellow
    & "$makeAppx" pack /d "$archStaging" /p "$outMsix" /o /nv | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[-] MakeAppx pack failed for $targetArch!"
        return $null
    }
    return $outMsix
}

$packedPackages = @()
if ($Arch -in @("all", "x64")) {
    $x64Bin = "release-builds\bukaake-v$semVer-x64.exe"
    if (-not (Test-Path $x64Bin)) { $x64Bin = "src-tauri\target\release\bukaake.exe" }
    $p = Invoke-StageAndPackArch -targetArch "x64" -binaryPath $x64Bin
    if ($p) { $packedPackages += $p }
}

if ($Arch -in @("all", "arm64")) {
    $armBin = "release-builds\bukaake-v$semVer-arm64.exe"
    if (-not (Test-Path $armBin)) { $armBin = "src-tauri\target\aarch64-pc-windows-msvc\release\bukaake.exe" }
    $p = Invoke-StageAndPackArch -targetArch "arm64" -binaryPath $armBin
    if ($p) { $packedPackages += $p }
}

if ($packedPackages.Count -eq 0) {
    Write-Error "[-] No MSIX packages were generated!"
    exit 1
}

# 4. Create Unified Bundle if multiple architectures, or copy individual MSIX
$bundleOut = "release-builds\Bukaake-v$semVer.msixbundle"
if ($packedPackages.Count -gt 1) {
    Write-Host "  [+] Assembling multi-arch bundle (x64 + ARM64) -> $bundleOut" -ForegroundColor Cyan
    & "$makeAppx" bundle /d "$stagingRoot\bundles" /p "$bundleOut" /bv "$appxVer" /o
    if ($LASTEXITCODE -ne 0) { Write-Error "[-] Bundle creation failed!"; exit 1 }
} else {
    $singleOut = "release-builds\Bukaake-v$semVer-$Arch.msix"
    Copy-Item $packedPackages[0] $singleOut -Force
    $bundleOut = $singleOut
}

# 5. Optional Dev Signing for Local Sideloading
if ($SignDev) {
    $signtool = Find-SdkTool "signtool.exe"
    if ($signtool) {
        Write-Host "  [+] Signing package for local sideloading..." -ForegroundColor Yellow
        $cert = Get-ChildItem "Cert:\CurrentUser\My" | Where-Object { $_.Subject -eq $storeCfg.publisherId } | Select-Object -First 1
        if (-not $cert) {
            Write-Host "  [+] Creating self-signed certificate for local testing ($($storeCfg.publisherId))..." -ForegroundColor Yellow
            $cert = New-SelfSignedCertificate -Type Custom -Subject $storeCfg.publisherId `
                -KeyUsage DigitalSignature -FriendlyName "Bukaake Store Dev Cert" `
                -CertStoreLocation "Cert:\CurrentUser\My" `
                -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")
        }
        if ($cert) {
            & "$signtool" sign /fd SHA256 /sha1 $cert.Thumbprint "$bundleOut"
            Write-Host "  [+] Package signed with thumbprint $($cert.Thumbprint)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "  ======================================================================" -ForegroundColor Green
Write-Host "    [+] Microsoft Store Package Build Complete!" -ForegroundColor White
Write-Host "  ======================================================================" -ForegroundColor Green
Write-Host "    Package File: $bundleOut" -ForegroundColor Green
Write-Host "    Ready to upload to Microsoft Partner Center dashboard under Bukaake!" -ForegroundColor Cyan
Write-Host ""
