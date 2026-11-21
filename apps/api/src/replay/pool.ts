import { Worker } from "node:worker_threads";
import type { ReplayJob, ReplayOutcome } from "./job";

/**
 * Replays run off the event loop, a few at a time (docs/cadrage.md, Sécurité, Anti-triche): the
 * VPS has 2 vCores, and a 10-hour log is seconds of work.
 */
export const REPLAY_LIMITS = { running: 2, waiting: 20, timeoutMs: 60_000 } as const;

export interface Replayer {
  /** Rejects with ReplayRefused, ReplayBusy, or any other error for a failure of the server. */
  run(job: ReplayJob): Promise<ReplayOutcome>;
}

/** The log is one no player can produce. */
export class ReplayRefused extends Error {}
/** Too many replays waiting: the client may send the log again later. */
export class ReplayBusy extends Error {}

export type WorkerReply = { ok: true; outcome: ReplayOutcome } | { ok: false; reason: string };

/** Runs at most `running` jobs at once, queues up to `waiting` more, refuses the rest. */
export function limitReplays(
  runJob: (job: ReplayJob) => Promise<ReplayOutcome>,
  limits: { running: number; waiting: number } = REPLAY_LIMITS,
): Replayer {
  let running = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    running--;
    queue.shift()?.();
  };
  return {
    async run(job) {
      if (running >= limits.running) {
        if (queue.length >= limits.waiting) throw new ReplayBusy("too many replays");
        await new Promise<void>((resolve) => queue.push(resolve));
      }
      running++;
      try {
        return await runJob(job);
      } finally {
        next();
      }
    },
  };
}

/** One worker per job, from `file` (dist/replayWorker.js), terminated past the timeout. */
export function workerReplayer(
  dataDir: string,
  options: { file: string; timeoutMs?: number },
): Replayer {
  const { file } = options;
  const timeoutMs = options.timeoutMs ?? REPLAY_LIMITS.timeoutMs;
  const runJob = (job: ReplayJob) =>
    new Promise<ReplayOutcome>((resolve, reject) => {
      const worker = new Worker(file, { workerData: { dataDir, job } });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error("replay timed out"));
      }, timeoutMs);
      const done = () => clearTimeout(timer);
      worker.once("message", (reply: WorkerReply) => {
        done();
        if (reply.ok) resolve(reply.outcome);
        else reject(new ReplayRefused(reply.reason));
      });
      worker.once("error", (error) => {
        done();
        reject(error);
      });
      worker.once("exit", (code) => {
        done();
        reject(new Error(`replay worker exited with code ${code}`));
      });
    });
  return limitReplays(runJob);
}
