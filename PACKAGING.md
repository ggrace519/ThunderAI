# Packaging ThunderAI for Thunderbird Installation

This guide explains how to package the ThunderAI addon for installation in Thunderbird.

## Prerequisites

- All addon files are in the project directory
- `manifest.json` is at the root of the project
- No build process is required (this is a pure WebExtension)

## Method 1: Create ZIP File (Recommended)

### On Windows (PowerShell) - Recommended:

**Option 1: Use the provided script (Easiest)**
```powershell
# Navigate to the project root directory
cd C:\coding-projects\ThunderAI

# Run the packaging script
.\package.ps1
```

**Option 2: Manual PowerShell command**
```powershell
# Navigate to the project root directory
cd C:\coding-projects\ThunderAI

# Create as .zip first (PowerShell only supports .zip extension)
$items = Get-ChildItem -Path . | Where-Object {
    $name = $_.Name
    -not ($name -like ".git*" -or $name -like "*.md" -or $name -like "*.sh" -or $name -like ".github*" -or $name -like "*.ps1")
}
Compress-Archive -Path $items -DestinationPath thunderai.zip -Force

# Rename to .xpi (they're the same format)
Rename-Item -Path thunderai.zip -NewName thunderai.xpi -Force
```

**Option 3: Simple version (includes all files) - May have structure issues**
```powershell
# Navigate to the project root directory
cd C:\coding-projects\ThunderAI

# WARNING: This method may create nested folders in the ZIP
# Better to use the package.ps1 script or Option 2
Compress-Archive -Path * -DestinationPath thunderai.zip -Force
Rename-Item -Path thunderai.zip -NewName thunderai.xpi -Force
```

**Important:** If you get a "corrupt" error, the ZIP structure might be wrong. The `package.ps1` script handles this correctly by ensuring files are at the root level.

### On Windows (Command Prompt):

```cmd
# Navigate to the project root directory
cd C:\coding-projects\ThunderAI

# Use PowerShell to create ZIP and rename to XPI
powershell -Command "Compress-Archive -Path * -DestinationPath thunderai.zip -Force; Rename-Item -Path thunderai.zip -NewName thunderai.xpi -Force"
```

### On Linux/Mac:

```bash
# Navigate to the project root directory
cd /path/to/ThunderAI

# Create ZIP file (exclude .git and other unnecessary files)
# Note: zip command may need to be installed (apt-get install zip or brew install zip)
zip -r thunderai.xpi . -x "*.git*" -x "*.md" -x "*.sh" -x ".github/*"
```

### Important Notes:

- The ZIP file should be renamed to `.xpi` extension
- `manifest.json` **must** be at the root of the ZIP (not in a subfolder)
- All files and folders should be included in the ZIP
- The `.xpi` file is just a ZIP file with a different extension

## Method 2: Manual ZIP Creation

1. Select all files and folders in the project root (except `.git`, `.github`, etc.)
2. Right-click and select "Send to" → "Compressed (zipped) folder"
3. Rename the resulting `.zip` file to `thunderai.xpi`

## Installation Methods

### Option A: Temporary Installation (For Development/Testing)

1. Open Thunderbird
2. Go to `about:debugging` (type in address bar)
3. Click "This Thunderbird" in the left sidebar
4. Click "Load Temporary Add-on..."
5. Navigate to your project folder and select `manifest.json`
6. The addon will be loaded temporarily (until Thunderbird restarts)

### Option B: Permanent Installation (From .xpi File)

1. Open Thunderbird
2. Go to `about:addons` (or Tools → Add-ons)
3. Click the gear icon (⚙️) in the top right
4. Select "Install Add-on From File..."
5. Navigate to and select your `thunderai.xpi` file
6. Click "Add" when prompted
7. The addon will be installed permanently

### Option C: Drag and Drop Installation

1. Create the `thunderai.xpi` file as described above
2. Open Thunderbird
3. Go to `about:addons`
4. Simply drag and drop the `.xpi` file into the Add-ons Manager window
5. Click "Add" when prompted

## Files to Include

Make sure your ZIP/.xpi includes:
- ✅ `manifest.json` (at root)
- ✅ All `_locales/` folders
- ✅ All `api_webchat/` files
- ✅ All `images/` files
- ✅ All `js/` files and subdirectories
- ✅ All `options/` files
- ✅ All `pages/` files and subdirectories
- ✅ All `popup/` files
- ✅ `mzta-background.html` and `mzta-background.js`
- ✅ `LICENSE` file

## Files to Exclude (Optional)

You can exclude these for a smaller package:
- ❌ `.git/` folder
- ❌ `.github/` folder
- ❌ `README.md`, `CHANGELOG.md`, `LANG.md`, `VENDORS.md`
- ❌ `PACKAGING.md` (this file)
- ❌ Any test files or development scripts

## Verifying the Package

Before distributing, verify your `.xpi` file:

1. Extract the `.xpi` file (it's just a ZIP)
2. Check that `manifest.json` is at the root
3. Verify all required files are present
4. Test installation in a clean Thunderbird profile

## Version Number

The version number is defined in `manifest.json`:
```json
"version": "3.7.5"
```

Update this before creating a new package for release.

## Distribution

For distribution on addons.thunderbird.net:
1. Create the `.xpi` file
2. Sign in to addons.thunderbird.net
3. Upload the `.xpi` file
4. The site will validate and sign your addon

## Troubleshooting

**"Invalid add-on" error:**
- Ensure `manifest.json` is at the root of the ZIP
- Check that the ZIP structure is flat (not nested in a folder)

**"Corrupted file" error:**
- Recreate the ZIP file
- Ensure you're using standard ZIP compression (not 7z or RAR)

**Addon doesn't load:**
- Check the Browser Console (`Ctrl+Shift+J`) for errors
- Verify all file paths in `manifest.json` are correct
- Ensure all referenced files exist in the package

