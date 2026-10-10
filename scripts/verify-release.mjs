import { readFile } from "node:fs/promises";

const packagePaths = [
  "package.json",
  "packages/core/package.json",
  "packages/application/package.json",
  "packages/mcp-server/package.json",
  "packages/telemetry-otel/package.json",
];

const manifests = await Promise.all(
  packagePaths.map(async (path) => {
    const content = await readFile(
      new URL(`../${path}`, import.meta.url),
      "utf8",
    );
    return [path, JSON.parse(content)];
  }),
);

const rootVersion = manifests[0][1].version;

for (const [path, manifest] of manifests) {
  if (manifest.version !== rootVersion) {
    throw new Error(
      `Version mismatch: ${path} is ${manifest.version}, expected ${rootVersion}.`,
    );
  }
}

const tag = process.env.GITHUB_REF_NAME;

if (tag !== undefined && tag.startsWith("v") && tag !== `v${rootVersion}`) {
  throw new Error(
    `Release tag ${tag} does not match package version v${rootVersion}.`,
  );
}

console.log(`Release metadata verified for ForgeMCP v${rootVersion}.`);
