---
name: graphify-sync
description: Rebuild the graphify knowledge graph for this repo. Use on a fresh machine (graphify-out/ is gitignored, so the graph is never committed and must be regenerated locally), or after code/doc changes, to refresh graph.json / graph.html / GRAPH_REPORT.md. Triggers like "graphify sync", "sync graphify", "rebuild the graph".
---

# graphify-sync

`graphify-out/` is **gitignored** — the knowledge graph is machine-local and never
committed. On a fresh clone (or to refresh after changes) regenerate it here.

- **No `graphify-out/graph.json` yet** (fresh machine) → full build via `/graphify`.
- **Graph exists, code/docs changed** → incremental via `/graphify --update` (re-extracts
  only new/changed files).

## Steps

1. Check state:
   ```bash
   test -f graphify-out/graph.json && echo EXISTS || echo MISSING
   ```
2. Run the matching graphify command from the repo root:
   - MISSING → `/graphify` (full build on `.`)
   - EXISTS  → `/graphify --update`

   Both are the same pipeline the `/graphify` skill drives — invoke that skill; do not
   reimplement it. Semantic extraction runs on docs/tasks; the 15 Tauri icon PNGs under
   `src-tauri/icons/` carry no knowledge value — skip them from semantic chunks.
3. Outputs land in `graphify-out/` (`graph.html`, `graph.json`, `GRAPH_REPORT.md`).
   They stay uncommitted by design.

## Notes

- Interpreter on this machine: uv tool venv at
  `C:\Users\ldile\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe`. The `/graphify`
  skill auto-detects and caches it to `graphify-out/.graphify_python`.
- No `GEMINI_API_KEY`/`GOOGLE_API_KEY` set → semantic extraction uses Claude subagents
  (free, slower). Set a Gemini key to speed it up.
