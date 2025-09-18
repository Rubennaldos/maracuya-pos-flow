// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig({
  // ❗️Base fija al nombre del repositorio de GitHub Pages
  base: "/maracuya-pos-flow/",

  server: {
    host: "::",
    port: 8080,
  },

  preview: {
    port: 8080,
  },

  build: {
    outDir: "dist",
    sourcemap: true,
  },

  // Solo usamos lovable-tagger en desarrollo
  plugins: [react(), componentTagger()].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
