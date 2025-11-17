# Makefile for building defense.tex

.PHONY: all clean view help

# Default target
all: defense.pdf

# Build the PDF (two passes for cross-references)
defense.pdf: defense.tex
	@echo "Building defense.pdf..."
	@pdflatex -shell-escape -interaction=nonstopmode defense.tex > /tmp/latex_build.log 2>&1
	@pdflatex -shell-escape -interaction=nonstopmode defense.tex > /tmp/latex_build2.log 2>&1
	@echo "✓ PDF generated successfully!"

# Clean auxiliary files
clean:
	@echo "Cleaning auxiliary files..."
	@rm -f defense.aux defense.log defense.out defense.toc defense.pdf
	@rm -rf _minted-defense/
	@echo "✓ Cleanup completed"

# View the PDF (Linux)
view: defense.pdf
	@xdg-open defense.pdf 2>/dev/null || open defense.pdf 2>/dev/null || echo "Please open defense.pdf manually"

# Show help
help:
	@echo "Available targets:"
	@echo "  make          - Build defense.pdf (default)"
	@echo "  make clean    - Remove all generated files"
	@echo "  make view     - Build and open the PDF"
	@echo "  make help     - Show this help message"
