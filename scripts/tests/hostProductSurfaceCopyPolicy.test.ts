import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const hostsRoot = join(root, "hosts");
const productSurfaceExtensions = new Set([
  ".cs",
  ".cpp",
  ".h",
  ".html",
  ".json",
  ".kt",
  ".lua",
  ".py",
  ".rs",
  ".toml",
  ".ts",
  ".tsx",
  ".uplugin",
  ".vsixmanifest",
  ".xml"
]);
const skippedDirectories = new Set([
  ".git",
  ".next",
  ".resolve-local",
  ".uxp-dev-tool",
  "dist",
  "node_modules",
  "target"
]);
const skippedFiles = new Set(["README.md"]);
const forbiddenProductCopyPattern =
  /scaffold|local-service proof|loaded-host proof|cloud-service proof|proof is required|No DX proof|metadata only|ProofBlock|ProofNotice/i;

const violations = [...walkHostProductFiles(hostsRoot)]
  .map((path) => ({
    path,
    source: readFileSync(path, "utf8")
  }))
  .filter(({ source }) => forbiddenProductCopyPattern.test(source))
  .map(({ path }) => relative(root, path).replaceAll("\\", "/"));

assert.deepEqual(violations, []);

console.log("Host product surface copy policy verified");

function* walkHostProductFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        yield* walkHostProductFiles(path);
      }
      continue;
    }

    if (!entry.isFile() || skippedFiles.has(entry.name) || !isProductSurfaceFile(entry.name)) {
      continue;
    }

    yield path;
  }
}

function isProductSurfaceFile(fileName: string) {
  for (const extension of productSurfaceExtensions) {
    if (fileName.endsWith(extension)) {
      return true;
    }
  }

  return false;
}
