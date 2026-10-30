import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "release/", "assets/", "original/", "game/", "tools/", "node_modules/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
