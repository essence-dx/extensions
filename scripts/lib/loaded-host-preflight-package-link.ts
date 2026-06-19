import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { classifyPackageOutputWeakness } from "./release-evidence-package-output-classifier.ts";

const receiptDirectory = ".dx/receipts/extensions";
const loadedHostPreflightReceiptName = "loaded-host-preflight-latest.json";

export function staleLoadedHostPreflightPackageLinkReason(
  workspaceRoot: string,
  adapterId: string
): string | undefined {
  const receiptPath = join(workspaceRoot, receiptDirectory, adapterId, loadedHostPreflightReceiptName);

  if (!existsSync(receiptPath)) {
    return undefined;
  }

  let receipt: Record<string, unknown>;

  try {
    const parsedReceipt = JSON.parse(readFileSync(receiptPath, "utf8"));

    if (!isRecord(parsedReceipt)) {
      return "loaded-host preflight receipt is not a JSON object";
    }

    receipt = parsedReceipt;
  } catch {
    return "loaded-host preflight receipt is not readable JSON";
  }

  if (receipt.receipt !== "dx.extension.loaded_host_preflight" || receipt.adapterId !== adapterId) {
    return undefined;
  }

  if (
    typeof receipt.packageOutputReceiptPath !== "string" ||
    !isSha256(receipt.packageOutputReceiptSha256)
  ) {
    return "loaded-host preflight package-output link is missing";
  }

  if (!existsSync(receipt.packageOutputReceiptPath)) {
    return "loaded-host preflight package-output receipt is missing";
  }

  const packageOutputReceiptBytes = readFileSync(receipt.packageOutputReceiptPath);
  const packageOutputReceiptSha256 = createHash("sha256").update(packageOutputReceiptBytes).digest("hex");

  if (packageOutputReceiptSha256 !== receipt.packageOutputReceiptSha256) {
    return "loaded-host preflight package-output link is stale";
  }

  const packageOutputReceipt = readJsonRecord(packageOutputReceiptBytes);

  if (!packageOutputReceipt) {
    return "package-output link is not readable JSON";
  }

  const packageOutputWeakness = classifyPackageOutputWeakness("package_output", packageOutputReceipt);

  return packageOutputWeakness
    ? `package-output link is weak: ${packageOutputWeakness}`
    : undefined;
}

function readJsonRecord(bytes: Buffer): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(bytes.toString("utf8"));

    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
