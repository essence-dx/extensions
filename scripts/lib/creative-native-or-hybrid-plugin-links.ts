import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { CreativeNativeOrHybridPluginProof } from "./creative-native-or-hybrid-plugin-proof.ts";
import { parseTomlDocument } from "./toml-lite.ts";
import {
  type EvidenceReceiptRequirement,
  parseEvidenceReceiptRequirement
} from "../release-evidence-requirements.ts";

interface ReleaseGateEntry {
  id: string;
  evidence_receipt_requirements: string[];
}

export function validateCreativeNativeLoadedHostLink(
  receipt: Record<string, unknown>,
  proof: CreativeNativeOrHybridPluginProof,
  packageOutputReceiptBytes: Buffer,
  packageSha256: string
): void {
  if (receipt.receipt !== "dx.extension.creative.loaded_host") {
    throw new Error("Creative native/hybrid proof must link to a creative loaded-host receipt.");
  }

  if (receipt.adapterId !== proof.adapterId || receipt.host !== proof.host) {
    throw new Error("Creative native/hybrid loaded-host receipt adapter or host mismatch.");
  }

  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const packageOutput = readRecordField(receipt, "packageOutput");
  const adobeUxp = readRecordField(receipt, "adobeUxp");

  if (releaseClaims?.loadedHostVerified !== true) {
    throw new Error("Creative native/hybrid loaded-host receipt must verify the host.");
  }

  if (
    packageOutput?.receiptPath !== proof.packageOutputReceiptPath ||
    packageOutput.receiptSha256 !== sha256(packageOutputReceiptBytes) ||
    packageOutput.packageSha256 !== packageSha256
  ) {
    throw new Error("Creative native/hybrid loaded-host receipt package-output linkage mismatch.");
  }

  if (adobeUxp?.pluginLoaded !== true || adobeUxp.panelRendered !== true) {
    throw new Error("Creative native/hybrid loaded-host receipt must verify the Adobe UXP panel.");
  }
}

export function validateCreativeNativeReleaseGateMapping(
  workspaceRoot: string,
  adapterId: string,
  receiptPath: string
): void {
  const receiptRelativePath = toWorkspaceRelativePath(workspaceRoot, receiptPath);
  const gate = readReleaseGateEntries(workspaceRoot).find((entry) => entry.id === adapterId);

  if (!gate) {
    throw new Error(`Creative native/hybrid proof has no release evidence gate for ${adapterId}.`);
  }

  const nativeRequirement = gate.evidence_receipt_requirements
    .map((requirement) => parseEvidenceReceiptRequirement(requirement))
    .filter((requirement): requirement is EvidenceReceiptRequirement => Boolean(requirement))
    .find((requirement) => requirement.kind === "native_or_hybrid_plugin");

  if (!nativeRequirement || nativeRequirement.receiptPath !== receiptRelativePath) {
    throw new Error(
      `Creative native/hybrid receipt path must match the native_or_hybrid_plugin release evidence gate for ${adapterId}.`
    );
  }
}

function readReleaseGateEntries(workspaceRoot: string): ReleaseGateEntry[] {
  const releaseGates = parseTomlDocument(
    readFileSync(join(workspaceRoot, "registry", "release-evidence-gates.toml"), "utf8")
  );

  return (releaseGates.arrays.extensions ?? []).map((entry) => ({
    id: entry.id,
    evidence_receipt_requirements: Array.isArray(entry.evidence_receipt_requirements)
      ? entry.evidence_receipt_requirements
      : []
  }));
}

function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  const relativePath = relative(workspaceRoot, absolutePath).replace(/\\/g, "/");

  if (
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    relativePath.startsWith("/") ||
    !relativePath.startsWith(".dx/receipts/extensions/")
  ) {
    throw new Error("Creative native/hybrid receipt path must stay under .dx/receipts/extensions.");
  }

  return relativePath;
}

function readRecordField(value: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const field = value[key];

  return typeof field === "object" && field !== null && !Array.isArray(field)
    ? field as Record<string, unknown>
    : undefined;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
