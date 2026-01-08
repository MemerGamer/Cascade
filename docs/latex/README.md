# LaTeX Documentation

This directory contains the complete LaTeX documentation for the Cascade project.

## Building the Documentation

### Quick Start (Docker - No Installation Required)

If you don't have LaTeX installed, you can use Docker to compile the document:

```bash
cd docs/latex && docker run --rm -v "$(pwd)/../..":/project -w /project/docs/latex texlive/texlive:latest sh -c "pdflatex -interaction=nonstopmode -jobname=CascadeDocumentation main.tex && pdflatex -interaction=nonstopmode -jobname=CascadeDocumentation main.tex"
```

This command:

- Uses the official TeX Live Docker image
- Mounts the project root directory (parent of `docs`) as `/project`
- Sets working directory to `/project/docs/latex`
- Runs `pdflatex` twice for proper cross-references
- Automatically removes the container after compilation (`--rm`)
- Outputs `CascadeDocumentation.pdf` in the `docs/latex/` directory

**Note**: The first run will download the Docker image (~3GB), but subsequent builds will be fast.

### Prerequisites (Local Installation)

If you prefer to install LaTeX locally:

- **Linux**: `texlive-full` or `texlive-most`
- **macOS**: MacTeX
- **Windows**: MiKTeX or TeX Live

### Build Commands (Local Installation)

#### Using pdflatex (Recommended)

```bash
cd docs/latex
pdflatex -jobname=CascadeDocumentation main.tex
pdflatex -jobname=CascadeDocumentation main.tex  # Run twice for proper cross-references
```

#### Using latexmk (Automated)

```bash
cd docs/latex
latexmk -pdf -jobname=CascadeDocumentation main.tex
```

This will automatically run pdflatex multiple times until all references are resolved.

#### Clean Build Artifacts

```bash
cd docs/latex
latexmk -c  # Clean auxiliary files
# Or manually:
rm -f *.aux *.log *.out *.toc *.fdb_latexmk *.fls *.synctex.gz
```

## Document Structure

The LaTeX document includes:

1. **Introduction** - Overview and key features
2. **Architecture** - System architecture with DDD analysis and TikZ diagrams
3. **Services** - Detailed microservices documentation
4. **Deployment** - GKE and local deployment guides
5. **API Reference** - API endpoint details

## Images

The document references images from:

- `../../docs/assets/`

## Notes

- The document uses TikZ for diagrams instead of Mermaid
- Images are centered using `\centering` and `[H]` float placement
- Code listings use the `listings` package with syntax highlighting
