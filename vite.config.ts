import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    // Para GitHub Pages en REPO de proyecto:
    // usa el nombre EXACTO del repositorio como base.
    // Si tu repo es "maracuya-pos-flow", esto está correcto.
    base: isProd ? "/maracuya-pos-flow/" : "/",

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

    plugins: [react(), !isProd && componentTagger()].filter(Boolean) as any,

    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
