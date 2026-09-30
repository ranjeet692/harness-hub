/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from GitHub Pages under /harness-hub/. Every page is prerendered to its own
// /harness-hub/<path>/index.html, so the base has to be absolute. Set BASE=/ for a root domain.
export default defineConfig({
  base: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BASE ?? "/harness-hub/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
