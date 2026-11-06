import { readdir, readFile } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"

const testRoot = fileURLToPath(new URL(".", import.meta.url))
const dataRoot = resolve(fileURLToPath(new URL("../data/", import.meta.url)))

function repositoryDataPlugin(): Plugin {
  return {
    name: "serve-and-copy-repository-json",

    configureServer(server) {
      server.middlewares.use("/data", async (request, response, next) => {
        try {
          const pathname = decodeURIComponent((request.url ?? "/").split("?")[0])
          const filePath = resolve(dataRoot, `.${pathname}`)
          if (!filePath.startsWith(dataRoot + sep)) {
            response.statusCode = 403
            response.end("Forbidden")
            return
          }
          const file = await readFile(filePath)
          response.setHeader("Content-Type", "application/json; charset=utf-8")
          response.setHeader("Cache-Control", "no-cache")
          response.end(file)
        } catch {
          next()
        }
      })
    },

    async generateBundle() {
      const emitDirectory = async (directory: string) => {
        const entries = await readdir(directory, { withFileTypes: true })
        for (const entry of entries) {
          const absolutePath = resolve(directory, entry.name)
          if (entry.isDirectory()) {
            await emitDirectory(absolutePath)
            continue
          }
          if (!entry.isFile() || !entry.name.endsWith(".json")) continue
          const relativePath = absolutePath.slice(dataRoot.length + 1).split(sep).join("/")
          this.emitFile({
            type: "asset",
            fileName: `data/${relativePath}`,
            source: await readFile(absolutePath),
          })
        }
      }
      await emitDirectory(dataRoot)
    },
  }
}

export default defineConfig({
  root: testRoot,
  base: "./",
  publicDir: false,
  plugins: [repositoryDataPlugin()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    minify: "oxc",
    cssMinify: "lightningcss",
    sourcemap: false,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        alternate: fileURLToPath(new URL("./alternate.html", import.meta.url)),
      },
    },
  },
})
