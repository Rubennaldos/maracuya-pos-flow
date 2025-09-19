import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  // 👇 base debe ser EXACTA al nombre del repo de Pages
  base: "/maracuya-pos-flow/",

  server: { host: "::", port: 8080 },
  preview: { port: 8080 },

  build: {
    outDir: "dist",
    sourcemap: true,
  },

  // 👇 Usa lovable-tagger SOLO en desarrollo
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
