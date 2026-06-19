import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildZedExtensionOutput } from "../build-zed-extension-output.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "zed", "dx-zed");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-zed-build-output-"));
const compiledWasmPath = join(outputRoot, "compiled-extension.wasm");

try {
  writeFileSync(compiledWasmPath, Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]));

  const result = buildZedExtensionOutput({
    adapterRoot,
    outputRoot,
    compiledWasmPath
  });

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.outputPath, join(outputRoot, "extension.wasm"));
  assert.equal(result.manifestPath, join(adapterRoot, "extension.toml"));
  assert.equal(result.cargoManifestPath, join(adapterRoot, "Cargo.toml"));
  assert.equal(result.cargoTarget, "wasm32-unknown-unknown");
  assert.equal(result.targetRoot, join(adapterRoot, "target"));
  assert.deepEqual(result.cargoArguments, [
    "build",
    "-j",
    "1",
    "--manifest-path",
    result.cargoManifestPath,
    "--target",
    result.cargoTarget,
    "--target-dir",
    result.targetRoot
  ]);

  assert.equal(existsSync(result.outputPath), true, "extension.wasm should be emitted");
  assert.deepEqual(
    Array.from(readFileSync(result.outputPath).subarray(0, 8)),
    [0, 97, 115, 109, 1, 0, 0, 0],
    "extension.wasm should keep the WebAssembly header"
  );

  const cargoSource = readFileSync(result.cargoManifestPath, "utf8");
  assert.match(
    cargoSource,
    /\[workspace\]/,
    "Zed Cargo.toml should be an isolated workspace so it can build outside the root Cargo workspace"
  );

  const readinessLedger = readFileSync(join(root, "registry", "extension-readiness.toml"), "utf8");
  const zedReadinessEntry = readZedReadinessEntry(readinessLedger);

  assert.doesNotMatch(
    zedReadinessEntry,
    /WebAssembly build proof/,
    "Zed readiness blockers should not list WebAssembly build proof after build-output proof exists"
  );
  assert.match(zedReadinessEntry, /loaded Zed dev-extension receipt/);
  assert.match(zedReadinessEntry, /gallery package proof/);
  assert.match(zedReadinessEntry, /signing receipt/);
  assert.match(zedReadinessEntry, /checksum receipt/);
  assert.doesNotMatch(
    zedReadinessEntry,
    /slash-command availability/i,
    "Zed readiness should not ask for slash-command-only proof that the loaded-host validator rejects"
  );
  assert.match(zedReadinessEntry, /installed source/i);
  assert.match(zedReadinessEntry, /extension index/i);
  assert.match(zedReadinessEntry, /host log/i);
  assert.match(zedReadinessEntry, /executable hash/i);
  assert.match(zedReadinessEntry, /package-matched WebAssembly/i);

  const starterGuide = readFileSync(join(root, "docs", "zed-extension-starter.md"), "utf8");

  assert.doesNotMatch(starterGuide, /WebAssembly build proof remains deferred/);
  assert.match(starterGuide, /WebAssembly build-output proof is present/);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Zed WebAssembly build output verified");

function readZedReadinessEntry(readinessLedger: string): string {
  const match = readinessLedger
    .split(/\n(?=\[\[extensions\]\])/)
    .find((entry) => entry.includes('id = "dx.zed.command-center"'));

  assert.ok(match, "Zed readiness entry should exist");

  return match;
}
