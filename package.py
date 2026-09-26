#!/usr/bin/env python3
"""
ThunderAI cross-platform packaging script.

Builds thunderai.xpi (a ZIP with manifest.json at the root) from the project
directory, excluding git metadata, docs, and all development-only tooling
(node_modules, tests, package manifests, packaging scripts).

Usage:  python3 package.py
"""

import fnmatch
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT = "thunderai.xpi"

# Directories never shipped in the add-on (matched at any depth).
EXCLUDE_DIRS = {".git", ".github", ".claude", "node_modules", "test", "demo", "docs", "coverage"}

# File-name patterns never shipped (developer/repo tooling).
EXCLUDE_FILE_PATTERNS = [
    "*.md", "*.ps1", "*.sh", "*.py", "*.zip", "*.xpi",
    ".gitignore", ".gitattributes",
    "package.json", "package-lock.json", "vitest.config.mjs",
    ".DS_Store", "Thumbs.db",
]


def is_excluded(rel_path):
    parts = rel_path.split(os.sep)
    if any(part in EXCLUDE_DIRS for part in parts):
        return True
    name = parts[-1]
    return any(fnmatch.fnmatch(name, pat) for pat in EXCLUDE_FILE_PATTERNS)


def main():
    out_path = os.path.join(ROOT, OUTPUT)
    if os.path.exists(out_path):
        os.remove(out_path)

    included = []
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            # Prune excluded directories in place so os.walk doesn't descend.
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            for fn in filenames:
                abs_path = os.path.join(dirpath, fn)
                rel_path = os.path.relpath(abs_path, ROOT)
                if is_excluded(rel_path):
                    continue
                # Store with forward slashes (ZIP convention).
                arcname = rel_path.replace(os.sep, "/")
                zf.write(abs_path, arcname)
                included.append(arcname)

    if "manifest.json" not in included:
        print("ERROR: manifest.json not found at archive root.", file=sys.stderr)
        sys.exit(1)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Created {OUTPUT}  ({len(included)} files, {size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
