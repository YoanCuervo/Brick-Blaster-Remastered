// electron-builder only packs files inside this app: bring the game build in as dist/.
import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "dist");

rmSync(target, { recursive: true, force: true });
cpSync(join(here, "..", "..", "packages", "game", "dist"), target, { recursive: true });
