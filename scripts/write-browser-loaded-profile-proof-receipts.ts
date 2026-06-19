import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type BrowserLoadedProfileProof,
  type BrowserLoadedProfileReceipt,
  writeBrowserLoadedProfileReceipt
} from "./write-browser-loaded-profile-receipt.ts";

export interface BrowserLoadedProfileProofReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proofPath: string;
}

export function writeBrowserLoadedProfileProofReceipts(
  root = process.cwd(),
  options: BrowserLoadedProfileProofReceiptOptions
): BrowserLoadedProfileReceipt[] {
  const proofPath = validateProofPath(options.proofPath);
  const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
    | BrowserLoadedProfileProof
    | BrowserLoadedProfileProof[];
  const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

  if (proofs.length === 0) {
    throw new Error("Browser loaded-profile proof JSON must include at least one proof.");
  }

  return proofs.map((proof) =>
    writeBrowserLoadedProfileReceipt(root, {
      generatedAt: options.generatedAt,
      verificationCommand: options.verificationCommand ?? "npm run smoke:browser-loaded-profile:j1",
      proof
    })
  );
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_BROWSER_LOADED_PROFILE_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_BROWSER_LOADED_PROFILE_PROOF_JSON must point to a browser loaded-profile proof JSON file.");
    }

    const receipts = writeBrowserLoadedProfileProofReceipts(process.cwd(), {
      proofPath,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:browser-loaded-profile:j1"
    });

    for (const receipt of receipts) {
      console.log(`${receipt.target} loaded-profile receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProofPath(path: string): string {
  if (!isAbsolute(path)) {
    throw new Error("Browser loaded-profile proof JSON path must be absolute.");
  }

  if (!existsSync(path)) {
    throw new Error(`Browser loaded-profile proof JSON does not exist: ${path}`);
  }

  return path;
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return (
    normalize(resolve(process.argv[1])).toLowerCase() ===
    normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}
