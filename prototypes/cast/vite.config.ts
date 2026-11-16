import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const cert = process.env.AUDIOPLAYER_TLS_CERT;
const key = process.env.AUDIOPLAYER_TLS_KEY;
if (Boolean(cert) !== Boolean(key)) throw new Error("Supply both AUDIOPLAYER_TLS_CERT and AUDIOPLAYER_TLS_KEY.");
export default defineConfig({
  base: "./",
  server: { https: cert && key ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined },
  build: {
    outDir: "prototypes/cast/dist",
    rollupOptions: { input: fileURLToPath(new URL("./index.html", import.meta.url)) },
  },
});
