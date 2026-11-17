import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, createPasswordHasher } from "./password";

const cheap = createPasswordHasher({ logN: 10, r: 8, p: 1 });

describe("the password hasher", () => {
  it("salts every hash and finds the password again", async () => {
    const a = await cheap.hash("Brique-Bleue9");
    const b = await cheap.hash("Brique-Bleue9");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$10\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/);
    expect(await cheap.verify("Brique-Bleue9", a)).toBe(true);
    expect(await cheap.verify("Brique-Bleue8", a)).toBe(false);
  });

  it("reads the parameters from the stored hash, so that they can be raised later", async () => {
    const stored = await cheap.hash("Brique-Bleue9");
    const stronger = createPasswordHasher({ logN: 11, r: 8, p: 1 });
    expect(await stronger.verify("Brique-Bleue9", stored)).toBe(true);
  });

  it("treats the two Unicode spellings of an accent as one", async () => {
    const stored = await cheap.hash("Brique-Bleué-9");
    expect(await cheap.verify("Brique-Bleué-9", stored)).toBe(true);
  });

  it("refuses a malformed or too costly stored hash rather than computing it", async () => {
    const stored = await cheap.hash("Brique-Bleue9");
    for (const bad of ["", "bcrypt$x", stored.replace("$10$", "$30$"), stored.slice(0, -4)]) {
      expect(await cheap.verify("Brique-Bleue9", bad)).toBe(false);
    }
  });

  it("uses OWASP's scrypt minimum by default", async () => {
    expect(DEFAULT_PARAMS).toEqual({ logN: 17, r: 8, p: 1 });
    const hasher = createPasswordHasher();
    const stored = await hasher.hash("Brique-Bleue9");
    expect(stored.startsWith("scrypt$17$8$1$")).toBe(true);
    expect(await hasher.verify("Brique-Bleue9", stored)).toBe(true);
  });

  it("spends a verify on an email with no account", async () => {
    await expect(cheap.verifyNothing("Brique-Bleue9")).resolves.toBeUndefined();
  });
});
