import { RESERVED_PSEUDO, isValidPseudo } from "@brick-blaster/contracts";
import { describe, expect, it } from "vitest";
import { isRefusedPseudo, provisionalPseudo } from "./pseudo";

describe("the provisional pseudo", () => {
  it("is « Joueur » and digits, valid, within 15 characters, and reserved", () => {
    for (let i = 0; i < 200; i++) {
      const pseudo = provisionalPseudo();
      expect(pseudo).toMatch(/^Joueur\d{5,9}$/);
      expect(isValidPseudo(pseudo)).toBe(true);
      expect(RESERVED_PSEUDO.test(pseudo)).toBe(true);
    }
  });
});

describe("the insult filter", () => {
  it("finds a long word anywhere, digits standing for letters", () => {
    for (const pseudo of ["Connard", "XxSal0pexX", "le batard", "Fuck", "B1TCH"]) {
      expect(isRefusedPseudo(pseudo)).toBe(true);
    }
  });

  it("finds a short word only on its own", () => {
    expect(isRefusedPseudo("gros con")).toBe(true);
    expect(isRefusedPseudo("Merde!")).toBe(true);
    for (const pseudo of ["Constant", "Montenegro", "Therapist", "Habite", "Torpedo", "Bass"]) {
      expect(isRefusedPseudo(pseudo)).toBe(false);
    }
  });

  it("lets ordinary pseudos through", () => {
    for (const pseudo of ["NovaKrak", "Brick Lord", "Krakatoa", "Nova Krak!"]) {
      expect(isRefusedPseudo(pseudo)).toBe(false);
    }
  });
});
