import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ReplayJob, ReplayOutcome } from "./job";
import { ReplayBusy, ReplayRefused, limitReplays, workerReplayer } from "./pool";

const job = (world: ReplayJob["world"]): ReplayJob => ({
  world,
  difficulty: 1,
  log: { version: 1, seed: 1, ops: [] },
});
const OUTCOME: ReplayOutcome = {
  kind: "left",
  score: 0,
  level: 1,
  durationTicks: 1,
  bricksBroken: 0,
  livesLost: 0,
};

describe("the replay limit", () => {
  it("runs a few replays at once, queues some, refuses the rest", async () => {
    let running = 0;
    let most = 0;
    const releases: (() => void)[] = [];
    const replayer = limitReplays(
      async () => {
        most = Math.max(most, ++running);
        await new Promise<void>((resolve) => releases.push(resolve));
        running--;
        return OUTCOME;
      },
      { running: 2, waiting: 1 },
    );
    const accepted = [1, 2, 3].map(() => replayer.run(job("espace")));
    await expect(replayer.run(job("espace"))).rejects.toBeInstanceOf(ReplayBusy);
    expect(releases).toHaveLength(2);
    // Each end lets the queued replay start.
    for (let done = 0; done < 3; done++) {
      while (releases.length === 0) await new Promise((r) => setTimeout(r, 1));
      releases.shift()!();
    }
    await expect(Promise.all(accepted)).resolves.toHaveLength(3);
    expect(most).toBe(2);
  });

  it("frees its slot when a replay fails", async () => {
    const replayer = limitReplays(async () => Promise.reject(new Error("crash")), {
      running: 1,
      waiting: 0,
    });
    await expect(replayer.run(job("espace"))).rejects.toThrow("crash");
    await expect(replayer.run(job("espace"))).rejects.toThrow("crash");
  });
});

describe("replays in worker threads", () => {
  const file = fileURLToPath(new URL("./fixtures/fakeWorker.mjs", import.meta.url));
  const replayer = workerReplayer("unused", { file, timeoutMs: 500 });

  it("returns the worker's outcome", async () => {
    await expect(replayer.run(job("espace"))).resolves.toEqual(OUTCOME);
  });

  it("turns a refusal of the replay into ReplayRefused", async () => {
    const refused = replayer.run(job("arcade"));
    await expect(refused).rejects.toBeInstanceOf(ReplayRefused);
    await expect(refused).rejects.toThrow("bad seed");
  });

  it("terminates a replay past its time", async () => {
    await expect(replayer.run(job("limbes"))).rejects.toThrow("replay timed out");
  });
});
