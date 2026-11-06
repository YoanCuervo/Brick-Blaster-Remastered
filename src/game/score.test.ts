import { describe, expect, it } from "vitest";
import { Difficulty } from "../data/config";
import {
  MAX_LIVES,
  MAX_SCORE,
  addSpareLivesBonus,
  addScore,
  checkExtraLife,
  createPlayer,
  gainLife,
  loseSpareLife,
  subtractScore,
} from "./score";

describe("addScore (0x40841D)", () => {
  it("adds 10 points per unit plus the difficulty bonus", () => {
    const p = createPlayer(3, 10000);
    addScore(p, 1, Difficulty.Easy);
    expect(p.score).toBe(10);
    addScore(p, 1, Difficulty.Medium);
    expect(p.score).toBe(30);
    addScore(p, 1, Difficulty.Hard);
    expect(p.score).toBe(60);
    addScore(p, 3, Difficulty.Hard);
    expect(p.score).toBe(110);
  });

  it("doubles the total with points x2", () => {
    const p = createPlayer(3, 10000);
    addScore(p, 1, Difficulty.Medium, true);
    expect(p.score).toBe(40);
  });

  it("stops at 999 990", () => {
    const p = createPlayer(3, 10000);
    p.score = MAX_SCORE - 10;
    addScore(p, 3, Difficulty.Hard);
    expect(p.score).toBe(MAX_SCORE);
  });
});

describe("lives", () => {
  it("starts with Nbs_Life − 1 spare lives (0x401D56)", () => {
    expect(createPlayer(3, 10000)).toEqual({ score: 0, lives: 2, nextLife: 10000 });
  });

  it("caps spare lives at 19 (0x405FD5)", () => {
    const p = createPlayer(20, 10000);
    gainLife(p);
    gainLife(p);
    expect(p.lives).toBe(MAX_LIVES);
  });
});

describe("checkExtraLife (0x40600B)", () => {
  it("awards a life and 8 units when the threshold is reached", () => {
    const p = createPlayer(3, 10000);
    p.score = 9990;
    expect(checkExtraLife(p, 10000, Difficulty.Medium)).toBe(false);
    p.score = 10000;
    expect(checkExtraLife(p, 10000, Difficulty.Medium)).toBe(true);
    expect(p).toEqual({ score: 10090, lives: 3, nextLife: 20000 });
    expect(checkExtraLife(p, 10000, Difficulty.Medium)).toBe(false);
  });

  it("gives one life per call even past several thresholds", () => {
    const p = createPlayer(3, 10000);
    p.score = 35000;
    expect(checkExtraLife(p, 10000, Difficulty.Easy)).toBe(true);
    expect(p.nextLife).toBe(20000);
    expect(checkExtraLife(p, 10000, Difficulty.Easy)).toBe(true);
    expect(p.lives).toBe(4);
  });
});

describe("subtractScore (0x4083D2)", () => {
  it("removes 10 per unit, without the difficulty bonus", () => {
    const p = createPlayer(3, 10000);
    p.score = 500;
    subtractScore(p, 12);
    expect(p.score).toBe(380);
  });

  it("doubles with points x2 and stops at 0", () => {
    const p = createPlayer(3, 10000);
    p.score = 500;
    subtractScore(p, 12, true);
    expect(p.score).toBe(260);
    p.score = 30;
    subtractScore(p, 12);
    expect(p.score).toBe(0);
  });
});

describe("loseSpareLife (0x405F7F)", () => {
  it("never goes below 0 spare lives", () => {
    const p = createPlayer(2, 10000);
    loseSpareLife(p);
    expect(p.lives).toBe(0);
    loseSpareLife(p);
    expect(p.lives).toBe(0);
  });
});

describe("addSpareLivesBonus", () => {
  it("pays each spare life, without touching them", () => {
    const p = createPlayer(3, 10000);
    p.score = 500;
    addSpareLivesBonus(p, 1000);
    expect(p.score).toBe(2500);
    expect(p.lives).toBe(2);
  });

  it("stops at the score cap", () => {
    const p = createPlayer(3, 10000);
    p.score = MAX_SCORE - 10;
    addSpareLivesBonus(p, 1000);
    expect(p.score).toBe(MAX_SCORE);
  });
});
