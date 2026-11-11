# Brick Blaster Remastered

Faithful web + Windows remake of Brick Blaster (Eclipse, 1999): original rules and assets, modern comfort.
Scope, choices and legal: [`docs/cadrage.md`](docs/cadrage.md). Reverse-engineered rules of the original (source of truth for gameplay): [`BRICK_BLASTER_ANALYSE.md`](BRICK_BLASTER_ANALYSE.md).

## Stack

- Game: TypeScript + Canvas 2D + Vite, no game framework, no React.
- 640×480 logical resolution, integer pixel scaling, optional fullscreen.
- Deterministic engine: fixed 60 Hz step (one tick per vertical blank of the original 60 Hz mode, §4.2), seeded RNG. Never use `Math.random()` or wall-clock time in game logic.
- Music: chiptune3 (libopenmpt WASM), bundled locally. FLC: in-house decoder.
- Storage: localStorage (high scores, settings). No backend in V1.
- Desktop: Electron + electron-builder (Windows 10+ .exe).
- Tests: Vitest, game logic only. Lint: ESLint (typescript-eslint) + Prettier.

V2 (planned, scope in `docs/cadrage.md`; only the monorepo move is done): website hosting the game. npm-workspaces monorepo (`apps/web` React + TS + Vite, `apps/api` Node + TS + Fastify, `apps/desktop` Electron, `packages/game` the current engine, `packages/contracts` web/api schemas, `deploy/` this project's Dockerfiles and Caddy/compose fragments; the shared server config lives in a separate infra repo), MySQL, Brevo emails, OVH VPS behind Cloudflare. The backend decides everything: every score is replayed server-side from its seed and input log, never trusted from the client.

## Commands

```bash
npm install
npm run dev            # browser version on http://localhost:5173 (needs assets/)
npm run build          # type-check + production build into packages/game/dist/, type-check of apps/desktop
npm test               # vitest in every workspace (packages/game/src/**/*.test.ts)
npm run lint
npm run format         # prettier (docs *.md are excluded on purpose)
npx vite --config tools/acceptance/vite.acceptance.config.ts   # dev server on port 5188, levels 39-40 reduced to one brick
npm run electron:dev   # build, then run it in Electron (no HMR: use npm run dev to iterate)
npm run electron:build # local Windows installer in release/ (holds Eclipse assets: never publish it); add -- --dir for release/win-unpacked only
tools/.venv/Scripts/python.exe tools/extract/extract_assets.py   # regenerate assets/ from original/
```

The installer build writes an uninstaller from an unknown .exe, which Windows Controlled Folder Access silently blocks under `Documents` (`__uninstaller.exe -> no files found`). Send the output elsewhere: `npm run electron:build -- -c.directories.output=C:/Users/cuerv/BrickBlaster-release`.

## Layout

npm workspaces: run every command from the root, which delegates to the right workspace.

```
packages/game/  @brick-blaster/game: engine + browser version (index.html, vite.config.ts)
  src/          game code (core/, game/, input/, render/, audio/, ui/, data/)
  src/assets/   free backgrounds and music of the browser version (versioned, credits in CREDITS.md)
apps/desktop/   @brick-blaster/desktop: Electron main process (compiled to dist-electron/); copy-game.js
                copies packages/game/dist into apps/desktop/dist, served over app://
assets/         asset pack generated from original/ (NOT versioned, served by Vite as publicDir)
original/       read-only reference copy of the 1999 game (NOT versioned)
game/           playable test copy of the original with test cfg/levels (NOT versioned)
tools/extract/  DIET decompressor + asset extraction (Python)
tools/re/       disassembly helpers (capstone), output in tools/re/out/
tools/acceptance/ short-world dev config, never part of the build
tools/limbes/   generates the Limbes backgrounds in packages/game/src/assets/backgrounds
tools/          make_test_cfg.py, make_test_levels.py, blaster_cfg_original.txt
docs/           cadrage.md
```

Python tooling runs in `tools/.venv` (capstone, Pillow), never in the system Python.

## Conventions

- Answer the user in French. Code, identifiers, file names, comments and commits in English.
- Comments only to explain a non-obvious choice. When a rule comes from the original, cite the analysis section or address (e.g. `// §4.2, 0x404610`).
- Conventional Commits: `type(scope): message`. One branch per task. Never push to `main` or `develop`.
- Branch flow: task branches start from `develop` and their PRs target `develop`. `main` only receives `develop` through PRs.
- GitHub: no Claude attribution anywhere (no `Co-Authored-By` trailer, no "Generated with Claude Code" line). Claude may commit, push branches and open PRs; only the user merges PRs.
- Before coding: announce the files created or modified and the approach, then wait for approval.
- No new dependency (npm or pip) without explicit approval.

## Fidelity rules

- Gameplay must match `BRICK_BLASTER_ANALYSE.md`. If a behaviour is undocumented or marked "probable", say so; do not invent. Prefer a targeted disassembly (`tools/re/`) or a test in `game/` over guessing.
- Units are the original ones: pixels per tick at 60 Hz, ticks for durations.
- Cover each decoded rule with a Vitest test.

## Legal

- No personal data, cookies or third-party services in V1: GDPR does not apply. V2 online leaderboard will: run `/conform-cnil` before going live.
- No accessibility obligation; keep menus keyboard-usable and readable.
- Eclipse assets must never be committed: the repo ships code only.

## Forbidden

- Reading or writing anything outside `C:\Users\cuerv\Documents\Dev\Brick_Blaster2k26`.
- Modifying `original/` or `tools/blaster_cfg_original.txt`.
- Publishing the .exe (GitHub release, CI upload): it contains the Eclipse assets.
- Committing `assets/`, `original/`, `game/`, `tools/blaster_cfg_original.txt`, `tools/.venv/`, `tools/deark/`, `tools/re/out/`, `.env*`.
- Reading or writing `.env*` files (blocked by permissions).
- Rebuilding `blaster.cfg` from scratch: it is read positionally and holds every game text (§5.1). Patch `blaster_cfg_original.txt` with `tools/make_test_cfg.py`.
