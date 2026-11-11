// Dev server for the acceptance run: the end of a world in two short levels, without a cheat in
// the game. It only overrides what blaster.cfg and the level files already decide, 40 levels
// included (§4.5), and `npm run build` never reads this file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { mergeConfig } from "vite";
import base from "../../packages/game/vite.config.ts";

const LEVEL_COUNT = 40;
const START_LEVEL = LEVEL_COUNT - 1;
/** Row and column in the way of the first serve, up and to the right (0x40513F). */
const BRICK_ROW = 20;
const BRICK_COLS = [8];

const readAsset = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../assets/${file}`, import.meta.url), "utf8")) as Record<
    string,
    unknown
  >;

const shortLevel = (): number[][] =>
  Array.from({ length: 30 }, (_, r) =>
    Array.from({ length: 13 }, (_, c) => (r === BRICK_ROW && BRICK_COLS.includes(c) ? 0x21 : 0)),
  );

function acceptanceConfig(): unknown {
  return { ...readAsset("config.json"), startLevel: START_LEVEL };
}

function acceptanceLevels(): unknown {
  const sets = readAsset("levels.json") as Record<string, number[][][]>;
  const shorten = (levels: number[][][]) =>
    levels.map((level, i) => (i >= START_LEVEL - 1 ? shortLevel() : level));
  return Object.fromEntries(Object.entries(sets).map(([name, set]) => [name, shorten(set)]));
}

function shortWorld(): Plugin {
  return {
    name: "acceptance-short-world",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const { url } = req as unknown as { url?: string };
        const path = url?.split("?")[0];
        if (path !== "/config.json" && path !== "/levels.json") return next();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(path === "/config.json" ? acceptanceConfig() : acceptanceLevels()));
      });
    },
  };
}

export default mergeConfig(base, {
  root: fileURLToPath(new URL("../../packages/game", import.meta.url)),
  server: { port: 5188, strictPort: true },
  plugins: [shortWorld()],
});
