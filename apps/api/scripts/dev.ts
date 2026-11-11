// Rebuilds the API on every change and restarts it: Node runs this file without a build.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (command: string, args: string[]): ChildProcess =>
  spawn(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });

// The first build must exist before node --watch can start on it.
const first = spawnSync("npx", ["vite", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (first.status !== 0) process.exit(first.status ?? 1);

const children = [
  run("npx", ["vite", "build", "--watch"]),
  run("node", ["--watch", "--env-file-if-exists=.env", "dist/server.js"]),
];
const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
