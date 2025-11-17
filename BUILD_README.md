# Building defense.tex - Comprehensive Guide

This document provides multiple ways to build the `defense.tex` LaTeX document into a PDF.

## Quick Start

The fastest way to build:

```bash
./build-defense.sh
```

## Method 1: Shell Script (Recommended)

### Using the build script:

```bash
# Make it executable (first time only)
chmod +x build-defense.sh

# Run the build
./build-defense.sh
```

**What it does:**
- Compiles LaTeX twice (for cross-references)
- Cleans up auxiliary files
- Shows file size and success status
- Saves logs to `/tmp/latex_build.log` and `/tmp/latex_build2.log`

## Method 2: Makefile

If you prefer using `make`:

```bash
# Build the PDF
make

# Build and open the PDF
make view

# Clean all generated files
make clean

# Show available commands
make help
```

## Method 3: Manual Commands

### Basic compilation:

```bash
pdflatex -shell-escape -interaction=nonstopmode defense.tex
pdflatex -shell-escape -interaction=nonstopmode defense.tex
```

### With cleanup:

```bash
pdflatex -shell-escape -interaction=nonstopmode defense.tex
pdflatex -shell-escape -interaction=nonstopmode defense.tex
rm -f defense.aux defense.log defense.out defense.toc
```

### Single command (one-liner):

```bash
pdflatex -shell-escape -interaction=nonstopmode defense.tex && pdflatex -shell-escape -interaction=nonstopmode defense.tex && echo "✓ Build complete: defense.pdf"
```

## Method 4: LaTeX Editor

If you use a LaTeX editor (TeXstudio, Overleaf, etc.):

1. Open `defense.tex`
2. Ensure `-shell-escape` flag is enabled in settings
3. Click "Build" or press F5
4. Compile twice for proper cross-references

## Understanding the Flags

- `-shell-escape`: Required for the `minted` package (code syntax highlighting)
- `-interaction=nonstopmode`: Continues compilation without stopping for errors
- **Two compilations**: First pass generates references, second pass resolves them

## Output

After successful build:
- **File:** `defense.pdf`
- **Size:** ~1.2 MB
- **Pages:** 34 pages
- **Content:** Complete design pattern defense with code examples and false positive analysis

## Viewing the PDF

### Linux:
```bash
xdg-open defense.pdf
```

### macOS:
```bash
open defense.pdf
```

### Windows (WSL):
```bash
explorer.exe defense.pdf
```

## Troubleshooting

### Missing `pygmentize` error:

Install Pygments:
```bash
sudo apt-get install python3-pygments  # Ubuntu/Debian
sudo yum install python3-pygments      # Fedora/RHEL
pip install Pygments                    # pip
```

### Unicode character errors:

These are warnings for Bengali characters in code examples. The PDF still builds successfully.

### "Missing minted output" errors:

Run the compilation twice. The first pass generates the minted cache, the second uses it.

## Cleaning Up

### Remove only auxiliary files:
```bash
rm -f defense.aux defense.log defense.out defense.toc
```

### Remove everything (including PDF):
```bash
make clean
# or manually:
rm -f defense.aux defense.log defense.out defense.toc defense.pdf
rm -rf _minted-defense/
```

## Build Logs

Compilation logs are saved to:
- `/tmp/latex_build.log` - First pass log
- `/tmp/latex_build2.log` - Second pass log

Check these if the build fails.

## Document Structure

The `defense.tex` includes:
- 16 design pattern analyses
- False positive identification
- Real code examples with line numbers
- UML diagrams
- Comprehensive rebuttals
- Evidence-based defense

## Requirements

- pdflatex (TeX Live 2020 or later)
- minted package
- Pygments (for syntax highlighting)
- Standard LaTeX packages (geometry, hyperref, graphicx, etc.)

All requirements are typically included in a full TeX Live installation.

---

**Generated:** 2025-11-17
**Document:** Design Pattern Implementation Defense
**Pages:** 34
**Version:** Final with False Positive Analysis
