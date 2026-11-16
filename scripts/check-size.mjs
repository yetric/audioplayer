import { build } from "esbuild";
import { gzipSync } from "node:zlib";

for (const [entry, budget] of [["dist/index.js", 7 * 1024], ["dist/react.js", 8 * 1024]]) {
  const result = await build({
    entryPoints: [entry], bundle: true, minify: true, format: "esm",
    external: ["react", "react/jsx-runtime"], write: false, target: "es2022",
  });
  const bytes = gzipSync(result.outputFiles[0].contents).length;
  console.log(`${entry}: ${bytes} bytes gzip (budget ${budget})`);
  if (bytes > budget) process.exitCode = 1;
}
