import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  // 👉 Forzamos assets desde la raíz para que Lovable los resuelva en /assets/...
  base: "/",

  server: { host: "::", port: 8080 },
  preview: { port: 8080 },

  build: {
    outDir: "dist",
    sourcemap: true,
  },

  // SOLO en desarrollo
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
