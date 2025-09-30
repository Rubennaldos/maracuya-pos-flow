import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  // 👇 base por destino:
  // - gh       → GitHub Pages (subruta /maracuya-pos-flow/)
  // - lovable  → Lovable (sirve desde raíz del sandbox)
  // - default  → './' (seguro para servidores estáticos genéricos)
  const base =
    mode === "gh"
      ? "/maracuya-pos-flow/"
      : mode === "lovable"
      ? "/"
      : "./";

  return {
    base,
    server: { host: "::", port: 8080 },
    preview: { port: 8080 },
    build: { outDir: "dist", sourcemap: true },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
