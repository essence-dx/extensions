import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DX_AFFINITY_SWATCHES,
  buildAffinityContentPackage
} from "../build-affinity-content-package.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "affinity", "dx-affinity-content");
const outputRoot = mkdtempSync(join(tmpdir(), "dx-affinity-content-output-"));

try {
  const result = buildAffinityContentPackage({
    adapterRoot,
    outputRoot
  });

  assert.equal(result.adapterRoot, adapterRoot);
  assert.equal(result.outputRoot, outputRoot);
  assert.equal(result.manifestPath, join(outputRoot, "affinity-content-manifest.json"));
  assert.equal(result.swatchPath, join(outputRoot, "swatches", "dx-core.ase"));
  assert.equal(result.metadataPath, join(outputRoot, "metadata", "dx-content-package.json"));
  assert.equal(result.guidePath, join(outputRoot, "README.md"));
  assert.deepEqual(result.inputs, [
    "affinity-content-manifest.json",
    "src/importGuide.ts",
    "src/contentPlans.ts"
  ]);

  assert.equal(existsSync(result.manifestPath), true, "Affinity content manifest should be emitted");
  assert.equal(existsSync(result.swatchPath), true, "Affinity ASE swatch package should be emitted");
  assert.equal(existsSync(result.metadataPath), true, "Affinity package metadata should be emitted");
  assert.equal(existsSync(result.guidePath), true, "Affinity package import guide should be emitted");

  const swatchBytes = readFileSync(result.swatchPath);
  assert.equal(swatchBytes.subarray(0, 4).toString("ascii"), "ASEF");
  assert.equal(swatchBytes.readUInt16BE(4), 1);
  assert.equal(swatchBytes.readUInt16BE(6), 0);
  assert.equal(swatchBytes.readUInt32BE(8), DX_AFFINITY_SWATCHES.length);
  assert.equal(readFirstBlockColorName(swatchBytes), DX_AFFINITY_SWATCHES[0]?.name);

  const metadata = JSON.parse(readFileSync(result.metadataPath, "utf8")) as {
    schema: string;
    adapterId: string;
    importArtifacts: string[];
    content: { swatches: Array<{ name: string; colorModel: string; channels: number[] }> };
  };
  assert.equal(metadata.schema, "dx.affinity_content_package");
  assert.equal(metadata.adapterId, "dx.affinity-content.bridge");
  assert.deepEqual(metadata.importArtifacts, ["swatches/dx-core.ase"]);
  assert.deepEqual(
    metadata.content.swatches.map((swatch) => swatch.name),
    DX_AFFINITY_SWATCHES.map((swatch) => swatch.name)
  );
  assert.equal(
    metadata.content.swatches.every(
      (swatch) =>
        swatch.colorModel === "RGB" &&
        swatch.channels.length === 3 &&
        swatch.channels.every((channel) => channel >= 0 && channel <= 1)
    ),
    true
  );

  const guide = readFileSync(result.guidePath, "utf8");
  assert.match(guide, /Import `swatches\/dx-core\.ase`/);
  assert.doesNotMatch(guide, /release-ready|published|installable/i);
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}

console.log("Affinity content package output verified");

function readFirstBlockColorName(bytes: Buffer): string {
  const blockType = bytes.readUInt16BE(12);
  const nameCharacterCount = bytes.readUInt16BE(18);
  const nameStart = 20;
  const nameEnd = nameStart + nameCharacterCount * 2;

  assert.equal(blockType, 0x0001);

  return decodeUtf16BigEndian(bytes.subarray(nameStart, nameEnd - 2));
}

function decodeUtf16BigEndian(bytes: Buffer): string {
  const littleEndianBytes = Buffer.alloc(bytes.length);

  for (let index = 0; index < bytes.length; index += 2) {
    littleEndianBytes[index] = bytes[index + 1];
    littleEndianBytes[index + 1] = bytes[index];
  }

  return littleEndianBytes.toString("utf16le");
}
