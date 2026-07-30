import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tailwind 走 postcss.config.mjs，与原项目一致
// base: "./" —— 站点部署在 GitHub Pages 的子目录下，资源必须走相对路径
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
