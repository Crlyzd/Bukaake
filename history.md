# Bukaake — Project History & Agent Memory

## Rules for Agents
1. **Check Before Planning**: Always read this file before formulating plans or changing code to avoid repeating past mistakes.
2. **Log Code Changes**: Append a brief summary ("just the gist") of modified files and objectives after each change.
3. **Log Mistakes**: When the user flags an error (*"don't do this"*, *"not what I expected"*, etc.), immediately log it under **Mistakes** with the strict rule to prevent repetition.

## Mistakes (Never Repeat)
- **[MISTAKE] Release Notes**: Never write in project folder (use task artifacts only). Never use `>` blockquotes or emojis. Never include download links. Never hype the tone—use professional, technical language. Mandatory format: Title, Target, Summary, Details.
- **[MISTAKE] Multi-File Commits**: Never lump unrelated files into a single commit. Inspect files, group by category/similarity, stage group-by-group, compose per-file notes + batch message, and execute commits.

## Change Log
- **2026-10-14** | `AGENTS.md`, `.agents/workflows/`, `history.md`: Synchronized project state, added grouped commit workflow, updated strict release notes rules, and initialized lean history ledger.
- **v1.1.0** | Screen Recording: Added mouse pointer toggle, Win32 low-level mouse hook click ripples, tactile click audio, and collapsible settings sections.
- **v1.0.3** | Platform & Tray: Universal idle working set memory reclamation (~15–20 MB) across all hidden tray transitions.
- **v1.0.0 – v1.0.2** | Core: Picasa-style stroke-free glassmorphic viewer, dual theme engine, LibRaw 4-tier RAW demosaicing, and MSIX Store packaging.
