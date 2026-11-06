import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"

const testRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  root: testRoot,
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    minify: "oxc",
    sourcemap: false,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        alternate: fileURLToPath(new URL("./alternate.html", import.meta.url)),
      },
    },
  },
})
