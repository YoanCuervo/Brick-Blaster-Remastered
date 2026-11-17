import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    // Same origin as in production (`/api` behind Caddy), so the SameSite=Strict cookie works without CORS.
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  preview: { port: 5174, strictPort: true },
  build: {
    target: "es2022",
  },
});
