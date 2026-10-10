import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packages = ["core", "application", "mcp-server", "telemetry-otel"];
const packageManager = process.env.npm_execpath;
assert.ok(
  packageManager?.includes("pnpm"),
  "Run this check with pnpm package:verify",
);
const { version } = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);

const scratch = await mkdtemp(join(tmpdir(), "forgemcp-consumer-"));

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit", timeout: 180000 });
}

try {
  for (const name of packages) {
    run(
      process.execPath,
      [packageManager, "pack", "--pack-destination", scratch],
      join(root, "packages", name),
    );
  }
  const tarballs = (await readdir(scratch)).filter((name) =>
    name.endsWith(".tgz"),
  );
  assert.equal(tarballs.length, packages.length);
  await writeFile(
    join(scratch, "package.json"),
    JSON.stringify({
      name: "forgemcp-release-consumer",
      private: true,
      type: "module",
    }),
  );
  // An external consumer must resolve rewritten workspace dependencies without
  // monorepo links. Scripts are unnecessary for these runtime-only packages.
  run(
    process.execPath,
    [
      packageManager,
      "exec",
      "npm",
      "install",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--ignore-scripts",
      ...tarballs.map((name) => join(scratch, name)),
    ],
    scratch,
  );
  for (const name of packages) {
    const installed = join(scratch, "node_modules", "@forgemcp", name);
    const manifest = JSON.parse(
      await readFile(join(installed, "package.json"), "utf8"),
    );
    assert.equal(manifest.version, version);
    for (const target of Object.values(manifest.exports)) {
      await access(join(installed, target.import));
      await access(join(installed, target.types));
    }
    for (const [dependency, range] of Object.entries(
      manifest.dependencies ?? {},
    )) {
      assert.ok(
        !range.startsWith("workspace:"),
        `${dependency} retained a workspace protocol`,
      );
      if (dependency.startsWith("@forgemcp/")) assert.equal(range, version);
    }
  }
  await copyFile(
    new URL("./fixtures/release-consumer.mjs", import.meta.url),
    join(scratch, "consumer.mjs"),
  );
  run(process.execPath, [join(scratch, "consumer.mjs")], scratch);
  console.log(
    `ForgeMCP v${version}: all four packed packages passed isolated consumer validation.`,
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
