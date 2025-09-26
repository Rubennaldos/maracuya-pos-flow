import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  // En prod relativo para funcionar dentro de iframes/subrutas (Lovable, etc.)
  // En dev absoluto para Vite.
  base: mode === "production" ? "./" : "/",

  server: { host: "::", port: 8080 },
  preview: { port: 8080 },

  build: {
    outDir: "dist",
    sourcemap: true,
  },

  // Usa lovable-tagger SOLO en desarrollo
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
