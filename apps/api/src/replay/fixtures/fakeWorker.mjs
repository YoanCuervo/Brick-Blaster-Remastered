// Stands for dist/replayWorker.js in pool.test.ts: answers from the job's world.
import { parentPort, workerData } from "node:worker_threads";

const { job } = workerData;
if (job.world === "espace") {
  parentPort.postMessage({
    ok: true,
    outcome: { kind: "left", score: 0, level: 1, durationTicks: 1, bricksBroken: 0, livesLost: 0 },
  });
} else if (job.world === "arcade") {
  parentPort.postMessage({ ok: false, reason: "bad seed" });
} else {
  // Never answers: the pool must terminate it.
  globalThis.setInterval(() => {}, 1000);
}
