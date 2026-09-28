import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  fixedExtension: true,
  sourcemap: true,
  clean: true,
  dts: true,
});
