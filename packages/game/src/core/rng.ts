/**
 * Seeded PRNG (mulberry32). Game logic must only draw from an Rng so that a
 * game can be replayed from its seed and inputs.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform 32-bit unsigned integer. */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /**
   * Uniform integer in [0, n], both bounds included, like the original rand
   * (0x404F42: mask to the next power of two, then rejection), see §4.1.
   */
  rand(n: number): number {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`rand(${n})`);
    let mask = 0;
    while (mask < n) mask = (mask << 1) | 1;
    let v: number;
    do v = this.nextUint32() & mask;
    while (v > n);
    return v;
  }

  getState(): number {
    return this.state;
  }
}
