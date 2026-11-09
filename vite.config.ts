import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Popup is built with React. background.js / content.js / manifest.json
// live in /public and are copied as-is (they must stay self-contained).
export default defineConfig({
  root: resolve(__dirname, "src/popup"),
  publicDir: resolve(__dirname, "public"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "chrome110",
    rollupOptions: {
      input: resolve(__dirname, "src/popup/index.html"),
    },
  },
});
