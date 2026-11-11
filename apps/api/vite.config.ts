import { defineConfig } from "vitest/config";

// Node cannot run the game sources as they are (extensionless imports, parameter properties):
// Vite bundles the API and every workspace package it imports into plain JavaScript for Node.
export default defineConfig({
  build: {
    ssr: true,
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { server: "src/server.ts", migrate: "src/migrateCli.ts" },
      output: { format: "es", entryFileNames: "[name].js" },
    },
  },
  ssr: {
    // npm packages stay in node_modules; the workspace packages are bundled.
    noExternal: [/^@brick-blaster\//],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
