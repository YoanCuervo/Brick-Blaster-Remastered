# Brick Blaster 2k26

Faithful web + Windows remake of Brick Blaster (Eclipse, 1999): original rules and assets, modern comfort.
Scope, choices and legal: [`docs/cadrage.md`](docs/cadrage.md). Reverse-engineered rules of the original (source of truth for gameplay): [`BRICK_BLASTER_ANALYSE.md`](BRICK_BLASTER_ANALYSE.md).

## Stack

- TypeScript + Canvas 2D + Vite, no game framework, no React.
- 640×480 logical resolution, integer pixel scaling, optional fullscreen.
- Deterministic engine: fixed 50 Hz step (original timer), seeded RNG. Never use `Math.random()` or wall-clock time in game logic.
- Music: chiptune3 (libopenmpt WASM), bundled locally. FLC: in-house decoder.
- Storage: localStorage (high scores, settings). No backend in V1.
- Desktop: Electron + electron-builder (Windows 10+ .exe).
- Tests: Vitest, game logic only. Lint: ESLint (typescript-eslint) + Prettier.

## Commands

```bash
npm install
npm run dev            # browser version on http://localhost:5173 (needs assets/)
npm run build          # type-check + production build into dist/
npm test               # vitest (src/**/*.test.ts)
npm run lint
npm run format         # prettier (docs *.md are excluded on purpose)
tools/.venv/Scripts/python.exe tools/extract/extract_assets.py   # regenerate assets/ from original/
```

Planned (task 16): `npm run electron:dev`, `npm run electron:build` (Windows .exe).

## Layout

```
src/            game code (core/, game/, render/, audio/, ui/, data/)
electron/       Electron main process
assets/         asset pack generated from original/ (NOT versioned, served by Vite)
original/       read-only reference copy of the 1999 game (NOT versioned)
game/           playable test copy of the original with test cfg/levels (NOT versioned)
tools/extract/  DIET decompressor + asset extraction (Python)
tools/re/       disassembly helpers (capstone), output in tools/re/out/
tools/          make_test_cfg.py, make_test_levels.py, blaster_cfg_original.txt
docs/           cadrage.md
```

Python tooling runs in `tools/.venv` (capstone, Pillow), never in the system Python.

## Conventions

- Answer the user in French. Code, identifiers, file names, comments and commits in English.
- Comments only to explain a non-obvious choice. When a rule comes from the original, cite the analysis section or address (e.g. `// §4.2, 0x404610`).
- Conventional Commits: `type(scope): message`. One branch per task. Never push to `main` or `develop`.
- GitHub: no Claude attribution anywhere (no `Co-Authored-By` trailer, no "Generated with Claude Code" line). Claude may commit, push branches and open PRs; only the user merges PRs. `main` changes only through merged PRs.
- Before coding: announce the files created or modified and the approach, then wait for approval.
- No new dependency (npm or pip) without explicit approval.

## Fidelity rules

- Gameplay must match `BRICK_BLASTER_ANALYSE.md`. If a behaviour is undocumented or marked "probable", say so; do not invent. Prefer a targeted disassembly (`tools/re/`) or a test in `game/` over guessing.
- Units are the original ones: pixels per tick at 50 Hz, ticks for durations.
- Cover each decoded rule with a Vitest test.

## Legal

- No personal data, cookies or third-party services in V1: GDPR does not apply. V2 online leaderboard will: run `/conform-cnil` before going live.
- No accessibility obligation; keep menus keyboard-usable and readable.
- Eclipse assets must never be committed: the repo ships code only.

## Forbidden

- Reading or writing anything outside `C:\Users\cuerv\Documents\Dev\Brick_Blaster2k26`.
- Modifying `original/` or `tools/blaster_cfg_original.txt`.
- Committing `assets/`, `original/`, `game/`, `tools/blaster_cfg_original.txt`, `tools/.venv/`, `tools/deark/`, `tools/re/out/`, `.env*`.
- Reading or writing `.env*` files (blocked by permissions).
- Rebuilding `blaster.cfg` from scratch: it is read positionally and holds every game text (§5.1). Patch `blaster_cfg_original.txt` with `tools/make_test_cfg.py`.
