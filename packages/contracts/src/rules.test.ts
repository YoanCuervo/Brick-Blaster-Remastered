import { describe, expect, it } from "vitest";
import { RESERVED_PSEUDO, isValidEmail, isValidPassword, isValidPseudo } from "./rules";

describe("the password rule", () => {
  it("wants 12 characters of 4 kinds", () => {
    expect(isValidPassword("Brique-Bleue9")).toBe(true);
    expect(isValidPassword("Brique-Ble9")).toBe(false); // 11
    expect(isValidPassword("brique-bleue9")).toBe(false); // no capital
    expect(isValidPassword("BRIQUE-BLEUE9")).toBe(false); // no small letter
    expect(isValidPassword("Brique-Bleue")).toBe(false); // no digit
    expect(isValidPassword("BriqueBleue99")).toBe(false); // no special character
  });

  it("counts an accented letter as a special character, and code points as length", () => {
    expect(isValidPassword("BriqueBleué9")).toBe(true);
    expect(isValidPassword("Aa1🧱🧱🧱🧱🧱🧱🧱🧱🧱")).toBe(true);
    expect(isValidPassword("Aa1-" + "x".repeat(124))).toBe(true);
    expect(isValidPassword("Aa1-" + "x".repeat(125))).toBe(false);
  });
});

describe("the email rule", () => {
  it("is loose but wants a domain", () => {
    expect(isValidEmail("nova@exemple.fr")).toBe(true);
    expect(isValidEmail("nova@exemple")).toBe(false);
    expect(isValidEmail(" nova@exemple.fr")).toBe(false);
  });
});

describe("the pseudo rule", () => {
  it("keeps to what the game can write, 3 to 15 characters", () => {
    expect(isValidPseudo("Nova Krak!")).toBe(true);
    expect(isValidPseudo("No")).toBe(false);
    expect(isValidPseudo("x".repeat(16))).toBe(false);
    expect(isValidPseudo("Novä")).toBe(false);
    expect(isValidPseudo("nova_krak")).toBe(false); // 0x408D3C would turn _ into DEL
    expect(isValidPseudo("nova@krak")).toBe(false);
  });

  it("refuses a space at either end", () => {
    expect(isValidPseudo(" Nova")).toBe(false);
    expect(isValidPseudo("Nova ")).toBe(false);
  });

  it("reserves the provisional pattern, whatever the case", () => {
    expect(RESERVED_PSEUDO.test("Joueur48213")).toBe(true);
    expect(RESERVED_PSEUDO.test("JOUEUR1")).toBe(true);
    expect(RESERVED_PSEUDO.test("Joueur")).toBe(false);
    expect(RESERVED_PSEUDO.test("Joueur 1")).toBe(false);
  });
});
