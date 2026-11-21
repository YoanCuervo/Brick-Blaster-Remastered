// Built to dist/replayWorker.js: one worker thread per replay, so that a long game never blocks
// the API's event loop, and a runaway one can be terminated.
import { ReplayError } from "@brick-blaster/game/headless";
import { parentPort, workerData } from "node:worker_threads";
import { type ReplayJob, loadGameData, runReplay } from "./job";
import type { WorkerReply } from "./pool";

const { dataDir, job } = workerData as { dataDir: string; job: ReplayJob };
let reply: WorkerReply;
try {
  reply = { ok: true, outcome: runReplay(loadGameData(dataDir), job) };
} catch (error: unknown) {
  if (!(error instanceof ReplayError)) throw error;
  reply = { ok: false, reason: error.message };
}
parentPort!.postMessage(reply);
