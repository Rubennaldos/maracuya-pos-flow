// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    // 🔴 MUY IMPORTANTE para GitHub Pages:
    // usa el nombre EXACTO del repositorio
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

    plugins: [react(), !isProd && componentTagger()].filter(Boolean),

    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
