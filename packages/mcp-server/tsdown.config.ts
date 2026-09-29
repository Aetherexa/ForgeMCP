import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/stdio.ts"],
  format: ["esm"],
  target: "node24",
  sourcemap: true,
  clean: true,
  dts: true,
});
