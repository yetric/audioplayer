import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/react.tsx"],
  external: ["react", "react/jsx-runtime"],
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "es2022",
});
