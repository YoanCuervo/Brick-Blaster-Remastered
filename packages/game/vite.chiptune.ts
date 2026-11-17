import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

const CHIPTUNE_FILES = ["chiptune3.worklet.js", "libopenmpt.worklet.js", "LICENSE"];
// npm workspaces hoist the package to the root node_modules.
const CHIPTUNE_DIR = dirname(createRequire(import.meta.url).resolve("chiptune3/package.json"));
const chiptuneSource = (file: string): Uint8Array => readFileSync(join(CHIPTUNE_DIR, file));

/**
 * Serves and emits the chiptune3 worklet under chiptune/. The worklet imports its WASM by
 * relative path: both keep their names, side by side. Shared by every app that runs the game.
 */
export function chiptuneWorklet(): Plugin {
  return {
    name: "chiptune-worklet",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const { url } = req as unknown as { url?: string };
        const file = url?.split("?")[0]?.match(/^\/chiptune\/(.+)$/)?.[1];
        if (!file || !CHIPTUNE_FILES.includes(file)) return next();
        res.setHeader("Content-Type", "text/javascript");
        res.end(chiptuneSource(file));
      });
    },
    generateBundle() {
      for (const file of CHIPTUNE_FILES) {
        this.emitFile({
          type: "asset",
          fileName: `chiptune/${file}`,
          source: chiptuneSource(file),
        });
      }
    },
  };
}
