#!/bin/bash

# Assignment 2 Report PDF Build Script

echo "=========================================="
echo "Building assignment2_report.tex PDF"
echo "=========================================="
echo ""

# Check if file exists
if [ ! -f "assignment2_report.tex" ]; then
    echo "Error: assignment2_report.tex not found!"
    exit 1
fi

echo "Step 1/2: First compilation pass..."
pdflatex -shell-escape -interaction=nonstopmode assignment2_report.tex > /tmp/assignment_build.log 2>&1

echo "Step 2/2: Second compilation pass..."
pdflatex -shell-escape -interaction=nonstopmode assignment2_report.tex > /tmp/assignment_build2.log 2>&1

echo ""
echo "Cleaning up auxiliary files..."
rm -f assignment2_report.aux assignment2_report.log assignment2_report.out assignment2_report.toc 2>/dev/null

echo ""
echo "=========================================="
if [ -f "assignment2_report.pdf" ]; then
    FILE_SIZE=$(du -h assignment2_report.pdf | cut -f1)

    echo "✓ PDF generated successfully!"
    echo ""
    echo "Output file: assignment2_report.pdf"
    echo "File size:   $FILE_SIZE"
    echo "=========================================="
    echo ""
    echo "To view the PDF:"
    echo "  xdg-open assignment2_report.pdf    (Linux)"
    echo "  open assignment2_report.pdf        (macOS)"
else
    echo "✗ PDF generation failed!"
    echo "Check the log files:"
    echo "  /tmp/assignment_build.log"
    echo "  /tmp/assignment_build2.log"
    exit 1
fi
