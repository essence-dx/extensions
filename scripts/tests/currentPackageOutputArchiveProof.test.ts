import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const targets = [
  {
    adapterId: "dx.intellij-platform.command-center",
    artifactField: "gradlePluginPackage",
    fileExtension: ".zip",
    headerBytes: [0x50, 0x4b, 0x03, 0x04],
    headerProofField: "zipHeaderVerified"
  },
  {
    adapterId: "dx.visual-studio.command-center",
    artifactField: "vsix",
    fileExtension: ".vsix",
    headerBytes: [0x50, 0x4b, 0x03, 0x04],
    headerProofField: "zipHeaderVerified"
  },
  {
    adapterId: "dx.unity-editor.command-center",
    artifactField: "upmTarball",
    fileExtension: ".tgz",
    headerBytes: [0x1f, 0x8b, 0x08],
    headerProofField: "gzipHeaderVerified"
  },
  {
    adapterId: "dx.unreal-engine.command-center",
    artifactField: "packagedPlugin",
    fileExtension: ".zip",
    headerBytes: [0x50, 0x4b, 0x03, 0x04],
    headerProofField: "zipHeaderVerified"
  }
] as const;

const existingTargets = targets.filter((target) => existsSync(packageOutputReceiptPath(target.adapterId)));

if (existingTargets.length === 0) {
  console.log("No current IDE or game-engine package-output receipts found; archive proof guard skipped");
} else {
  assert.equal(
    existingTargets.length,
    targets.length,
    "current IDE and game-engine package-output receipts must be regenerated as a complete set"
  );

  for (const target of targets) {
    const receipt = readJson(packageOutputReceiptPath(target.adapterId));
    const artifactProof = receipt[target.artifactField];

    assertArchiveProof(target.adapterId, target, artifactProof);
  }

  console.log("Current IDE and game-engine package-output archive proofs verified");
}

function packageOutputReceiptPath(adapterId: string): string {
  return join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "package-output-latest.json");
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function assertArchiveProof(
  adapterId: string,
  target: (typeof targets)[number],
  value: unknown
): void {
  assert.equal(typeof value, "object", `${adapterId} must include ${target.artifactField} archive proof`);
  assert.notEqual(value, null, `${adapterId} must include ${target.artifactField} archive proof`);

  const proof = value as Record<string, unknown>;
  const path = expectString(proof.path, `${adapterId} ${target.artifactField}.path`);
  const fileName = expectString(proof.fileName, `${adapterId} ${target.artifactField}.fileName`);
  const bytes = expectPositiveInteger(proof.bytes, `${adapterId} ${target.artifactField}.bytes`);
  const sha256 = expectSha256(proof.sha256, `${adapterId} ${target.artifactField}.sha256`);

  assert.equal(fileName.endsWith(target.fileExtension), true, `${adapterId} archive file extension mismatch`);
  assert.equal(
    proof[target.headerProofField],
    true,
    `${adapterId} must verify ${target.headerProofField}`
  );
  assert.equal(existsSync(path), true, `${adapterId} archive artifact must exist: ${path}`);

  const artifactBytes = readFileSync(path);
  assert.equal(bytes, artifactBytes.length, `${adapterId} archive size must match the receipt`);
  assert.equal(sha256, createHash("sha256").update(artifactBytes).digest("hex"));
  assert.deepEqual(
    Array.from(artifactBytes.subarray(0, target.headerBytes.length)),
    target.headerBytes,
    `${adapterId} archive header must match ${target.fileExtension}`
  );
}

function expectString(value: unknown, label: string): string {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.notEqual(value.trim(), "", `${label} must be non-empty`);

  return value;
}

function expectPositiveInteger(value: unknown, label: string): number {
  assert.equal(Number.isSafeInteger(value), true, `${label} must be a safe integer`);
  assert.ok((value as number) > 0, `${label} must be positive`);

  return value as number;
}

function expectSha256(value: unknown, label: string): string {
  const hash = expectString(value, label);

  assert.match(hash, /^[0-9a-f]{64}$/, `${label} must be a SHA-256 hex digest`);

  return hash;
}
