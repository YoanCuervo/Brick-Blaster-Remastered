import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/** apps/api/src/mail/templates.ts (LOGO_PATH) links to it from the emails. */
const LOGO_URL = "/email/logo.png";
const LOGO_FILE = fileURLToPath(new URL("./src/assets/email/logo.png", import.meta.url));

/**
 * Serves and emits the email logo at a fixed address: mail clients fetch it long after the
 * build, so it cannot carry a content hash. The public dir is the game's asset pack.
 */
export function emailLogo(): Plugin {
  return {
    name: "email-logo",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== LOGO_URL) return next();
        res.setHeader("Content-Type", "image/png");
        res.end(readFileSync(LOGO_FILE));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: LOGO_URL.slice(1),
        source: readFileSync(LOGO_FILE),
      });
    },
  };
}
