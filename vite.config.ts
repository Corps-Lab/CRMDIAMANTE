import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { createCaixaOfficialProxyPlugin } from "./scripts/caixaOfficialProxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const githubRepoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const githubPagesBase = githubRepoName ? `/${githubRepoName}/` : "/";
  const basePath =
    mode === "html"
      ? "./"
      : env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? githubPagesBase : "/");

  return {
    base: mode === "development" ? "/" : basePath,
    define: {
      __APP_VERSION__: JSON.stringify(new Date().toISOString()),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), createCaixaOfficialProxyPlugin(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
