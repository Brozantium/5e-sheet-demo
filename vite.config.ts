import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "8443", 10);

export default defineConfig(({ mode }) => {
  const development = mode === "development";

  return {
    base: process.env.VITE_BASE ?? "/",
    build: {
      sourcemap: development ? "inline" : false,
      minify: !development,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
      },
    },
    server: {
      host,
      port,
      strictPort: true,
    },
    preview: {
      host,
      port,
    },
  };
});
