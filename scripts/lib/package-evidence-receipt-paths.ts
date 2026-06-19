import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseEvidenceReceiptRequirement } from "../release-evidence-requirements.ts";
import { parseTomlDocument } from "./toml-lite.ts";

const releaseGatesRelativePath = "registry/release-evidence-gates.toml";
const receiptDirectory = ".dx/receipts/extensions";
const defaultPackageOutputReceiptName = "package-output-latest.json";

export function readPackageEvidenceReceiptPaths(workspaceRoot: string): Map<string, string> {
  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);
  const receiptPaths = new Map<string, string>();

  if (!existsSync(releaseGatesPath)) {
    return receiptPaths;
  }

  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));

  for (const entry of releaseGates.arrays.extensions ?? []) {
    if (typeof entry.id !== "string" || !Array.isArray(entry.evidence_receipt_requirements)) {
      continue;
    }

    const packageOutputRequirement = entry.evidence_receipt_requirements
      .map((requirement) =>
        typeof requirement === "string" ? parseEvidenceReceiptRequirement(requirement) : undefined
      )
      .find((requirement) => requirement?.kind === "package_output");

    if (packageOutputRequirement) {
      receiptPaths.set(entry.id, packageOutputRequirement.receiptPath);
    }
  }

  return receiptPaths;
}

export function resolvePackageEvidenceReceiptPath(
  workspaceRoot: string,
  adapterId: string,
  packageEvidenceReceiptById: Map<string, string>,
  fallbackReceiptName = defaultPackageOutputReceiptName
): string {
  const releaseGateReceiptPath = packageEvidenceReceiptById.get(adapterId);

  if (releaseGateReceiptPath) {
    return join(workspaceRoot, ...releaseGateReceiptPath.split("/"));
  }

  return join(workspaceRoot, receiptDirectory, adapterId, fallbackReceiptName);
}
