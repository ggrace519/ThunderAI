# ThunderAI Packaging Script for Windows
# This script creates a .xpi file for Thunderbird installation

$ErrorActionPreference = "Stop"

Write-Host "ThunderAI Packaging Script" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory (project root)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Output file names (create as .zip first, then rename to .xpi)
$outputFileZip = "thunderai.zip"
$outputFile = "thunderai.xpi"

# Remove existing files if they exist
if (Test-Path $outputFile) {
    Write-Host "Removing existing $outputFile..." -ForegroundColor Yellow
    Remove-Item $outputFile -Force
}
if (Test-Path $outputFileZip) {
    Write-Host "Removing existing $outputFileZip..." -ForegroundColor Yellow
    Remove-Item $outputFileZip -Force
}

Write-Host "Creating $outputFile..." -ForegroundColor Green

# Files and folders to exclude
$excludeItems = @(
    ".git",
    ".github",
    ".claude",
    "*.md",
    "*.ps1",
    "*.sh",
    "*.py",
    ".gitignore",
    ".gitattributes",
    # Development-only tooling — must NOT ship in the add-on
    "node_modules",
    "test",
    "demo",
    "docs",
    "coverage",
    "package.json",
    "package-lock.json",
    "vitest.config.mjs"
)

# Get all items to include (exclude the patterns)
$itemsToInclude = Get-ChildItem -Path . | Where-Object {
    $item = $_
    $shouldExclude = $false
    foreach ($pattern in $excludeItems) {
        if ($item.Name -like $pattern -or ($item.PSIsContainer -and $item.Name -eq $pattern.Replace('*', ''))) {
            $shouldExclude = $true
            break
        }
    }
    -not $shouldExclude
}

try {
    # Create a temporary directory to build the package
    $tempDir = Join-Path $env:TEMP "thunderai_package_$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    Write-Host "Copying files to temporary directory..." -ForegroundColor Gray
    
    # Copy all files and folders to temp directory (preserving structure)
    foreach ($item in $itemsToInclude) {
        $destPath = Join-Path $tempDir $item.Name
        if ($item.PSIsContainer) {
            Copy-Item -Path $item.FullName -Destination $destPath -Recurse -Force
        } else {
            Copy-Item -Path $item.FullName -Destination $destPath -Force
        }
    }
    
    # Verify manifest.json exists
    $manifestPath = Join-Path $tempDir "manifest.json"
    if (-not (Test-Path $manifestPath)) {
        throw "manifest.json not found! Make sure you're running this from the project root."
    }
    
    Write-Host "Creating ZIP archive..." -ForegroundColor Gray
    
    # Create the ZIP file from the temp directory contents (not the directory itself)
    $tempItems = Get-ChildItem -Path $tempDir
    Compress-Archive -Path $tempItems -DestinationPath $outputFileZip -Force
    
    # Rename .zip to .xpi (they're the same format)
    Rename-Item -Path $outputFileZip -NewName $outputFile -Force
    
    # Clean up temp directory
    Remove-Item -Path $tempDir -Recurse -Force
    
    Write-Host "Cleaned up temporary files." -ForegroundColor Gray
    
    # Get file size
    $fileSize = (Get-Item $outputFile).Length / 1KB
    Write-Host ""
    Write-Host "✓ Successfully created $outputFile" -ForegroundColor Green
    Write-Host "  File size: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can now install this addon in Thunderbird:" -ForegroundColor Cyan
    Write-Host "  1. Open Thunderbird" -ForegroundColor White
    Write-Host "  2. Go to about:addons" -ForegroundColor White
    Write-Host "  3. Click the gear icon → 'Install Add-on From File...'" -ForegroundColor White
    Write-Host "  4. Select: $outputFile" -ForegroundColor White
    Write-Host ""
    Write-Host "Or drag and drop $outputFile into the Add-ons Manager." -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "✗ Error creating package: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}


