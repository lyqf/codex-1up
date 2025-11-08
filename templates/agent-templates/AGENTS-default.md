# AGENTS.md — Tool Selection

When you need to call tools from the shell, use this rubric:

## File Operations
- Use `fd` for finding files: `fd --full-path '<pattern>' | head -n 1`

## Structured Code Search
- Find code structure: `ast-grep --lang <language> -p '<pattern>'`
- List matching files: `ast-grep -l --lang <language> -p '<pattern>' | head -n 10`
- Prefer `ast-grep` over `rg`/`grep` when you need syntax-aware matching

## Data Processing
- JSON: `jq`
- YAML/XML: `yq`

## Selection
- Select from multiple results deterministically (non-interactive filtering)
- Fuzzy finder: `fzf --filter 'term' | head -n 1`

## Guidelines
- Prefer deterministic, non-interactive commands (`head`, `--filter`, `--json` + `jq`) so runs are reproducible
