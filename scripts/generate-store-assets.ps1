# ==============================================================================
# Bukaake - Microsoft Store Visual Asset Generator
# Generates required unplated and tile assets for MSIX package from icon.png (< 100 lines)
# ==============================================================================

param(
    [string]$SourceIcon = "src-tauri\icons\icon.png",
    [string]$OutputDir = "packaging\msix\Assets"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceIcon)) {
    Write-Error "Source icon not found at: $SourceIcon"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$srcBitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SourceIcon).Path)

function Resize-SquareImage {
    param([int]$size, [string]$outPath)
    $dest = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcBitmap, 0, 0, $size, $size)
    $g.Dispose()
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "  [+] Generated: $outPath ($size x $size)" -ForegroundColor Green
}

function New-LetterboxedImage {
    param([int]$width, [int]$height, [int]$iconSize, [string]$outPath, [System.Drawing.Color]$bg)
    $dest = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bg)
    $x = ($width - $iconSize) / 2
    $y = ($height - $iconSize) / 2
    $g.DrawImage($srcBitmap, $x, $y, $iconSize, $iconSize)
    $g.Dispose()
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "  [+] Generated: $outPath ($width x $height)" -ForegroundColor Green
}

Write-Host "`n  [*] Generating Microsoft Store Visual Assets..." -ForegroundColor Cyan

# 1. Store and App List Icons
Resize-SquareImage -size 50 -outPath (Join-Path $OutputDir "StoreLogo.png")
Resize-SquareImage -size 44 -outPath (Join-Path $OutputDir "Square44x44Logo.png")
Resize-SquareImage -size 24 -outPath (Join-Path $OutputDir "Square44x44Logo.targetsize-24_altform-unplated.png")
Resize-SquareImage -size 150 -outPath (Join-Path $OutputDir "Square150x150Logo.png")

# 2. Wide Tile & Splash Screen (Pillar 2 Obsidian Tint #06070a)
$obsidian = [System.Drawing.Color]::FromArgb(6, 7, 10)
New-LetterboxedImage -width 310 -height 150 -iconSize 100 -outPath (Join-Path $OutputDir "Wide310x150Logo.png") -bg $obsidian
New-LetterboxedImage -width 620 -height 300 -iconSize 150 -outPath (Join-Path $OutputDir "SplashScreen.png") -bg $obsidian

$srcBitmap.Dispose()
Write-Host "  [+] Store assets generation complete!`n" -ForegroundColor Green
