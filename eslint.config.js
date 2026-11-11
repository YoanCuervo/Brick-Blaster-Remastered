import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/dist-electron/",
      ".cache/",
      "release/",
      "assets/",
      "original/",
      "game/",
      "tools/",
      "node_modules/",
      // Git worktrees of other branches: each holds a full copy of the repo.
      ".claude/",
      ".worktrees/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
