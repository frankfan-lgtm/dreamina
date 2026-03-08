import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 前端请求 /api/claude -> 代理到 Anthropic API，解决跨域
      "/api/claude": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, "/v1/messages"),
        headers: {
          "anthropic-version": "2023-06-01",
        },
      },
    },
  },
});
