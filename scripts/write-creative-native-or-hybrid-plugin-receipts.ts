import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type CreativeNativeOrHybridPluginProof,
  assertExistingAbsoluteFile,
  resolveCreativeNativeAdapter,
  validateCreativeNativeOrHybridPluginProof
} from "./lib/creative-native-or-hybrid-plugin-proof.ts";
import {
  validateCreativeNativeLoadedHostLink,
  validateCreativeNativeReleaseGateMapping
} from "./lib/creative-native-or-hybrid-plugin-links.ts";
import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export type { CreativeNativeOrHybridPluginProof };

export interface CreativeNativeOrHybridPluginReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  receiptPath?: string;
  proof: CreativeNativeOrHybridPluginProof;
}

export interface CreativeNativeOrHybridPluginReceipt {
  receipt: "dx.extension.creative.native_or_hybrid_plugin";
  adapterId: string;
  host: string;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedHostReceiptPath: string;
  loadedHostReceiptSha256: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
    filesVerified: number;
  };
  nativePlugin: {
    kind: string;
    sdkName: string;
    sdkVersion: string;
    artifactPath: string;
    fileName: string;
    bytes: number;
    sha256: string;
    loadedByHost: true;
    bridgeMode: string;
    commandIdsVerified: string[];
    metadataOnly: true;
    storesHostPayloads: false;
    mutatesHostProject: false;
    mutatesHostDocument: false;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    loadedHostVerified: true;
    packageOutputVerified: true;
    nativeOrHybridPluginVerified: true;
    ccxPackaged: false;
    localServiceVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export function writeCreativeNativeOrHybridPluginReceipt(
  root = process.cwd(),
  options: CreativeNativeOrHybridPluginReceiptOptions
): CreativeNativeOrHybridPluginReceipt {
  const workspaceRoot = resolve(root);
  const gateFailures = validateReleaseEvidenceGates(workspaceRoot);

  if (gateFailures.length > 0) {
    throw new Error(gateFailures.join("\n"));
  }

  const proof = validateCreativeNativeOrHybridPluginProof(options.proof);
  const config = resolveCreativeNativeAdapter(proof);
  const receiptPath = resolve(
    options.receiptPath ??
      join(workspaceRoot, ".dx", "receipts", "extensions", config.adapterId, "native-plugin-latest.json")
  );

  validateCreativeNativeReleaseGateMapping(workspaceRoot, config.adapterId, receiptPath);

  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const loadedHostReceiptBytes = readFileSync(proof.loadedHostReceiptPath);
  const proofFileBytes = readFileSync(proof.proofFilePath);
  const nativePluginBytes = readFileSync(proof.nativePluginArtifactPath);
  const packageOutput = verifyPackageOutputReceipt(
    config.adapterId,
    JSON.parse(packageOutputReceiptBytes.toString("utf8"))
  );

  validateCreativeNativeLoadedHostLink(
    JSON.parse(loadedHostReceiptBytes.toString("utf8")),
    proof,
    packageOutputReceiptBytes,
    packageOutput.sha256
  );

  const receipt: CreativeNativeOrHybridPluginReceipt = {
    receipt: "dx.extension.creative.native_or_hybrid_plugin",
    adapterId: config.adapterId,
    host: config.host,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:creative-native-or-hybrid-plugin:j1",
    receiptPath,
    loadedHostReceiptPath: proof.loadedHostReceiptPath,
    loadedHostReceiptSha256: sha256(loadedHostReceiptBytes),
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutput.sha256,
      filesVerified: packageOutput.filesVerified
    },
    nativePlugin: {
      kind: proof.pluginKind,
      sdkName: proof.sdkName,
      sdkVersion: proof.sdkVersion.trim(),
      artifactPath: proof.nativePluginArtifactPath,
      fileName: basename(proof.nativePluginArtifactPath),
      bytes: nativePluginBytes.length,
      sha256: sha256(nativePluginBytes),
      loadedByHost: true,
      bridgeMode: proof.bridgeMode,
      commandIdsVerified: uniqueSorted(proof.commandIdsVerified),
      metadataOnly: true,
      storesHostPayloads: false,
      mutatesHostProject: false,
      mutatesHostDocument: false
    },
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      loadedHostVerified: true,
      packageOutputVerified: true,
      nativeOrHybridPluginVerified: true,
      ccxPackaged: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_CREATIVE_NATIVE_OR_HYBRID_PLUGIN_PROOF_JSON;

    if (!proofPath) {
      throw new Error(
        "DX_CREATIVE_NATIVE_OR_HYBRID_PLUGIN_PROOF_JSON must point to a creative native/hybrid proof JSON file."
      );
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | CreativeNativeOrHybridPluginProof
      | CreativeNativeOrHybridPluginProof[];
    const proofs = Array.isArray(proofSource) ? proofSource : [proofSource];

    for (const proof of proofs) {
      const receipt = writeCreativeNativeOrHybridPluginReceipt(process.cwd(), {
        proof,
        verificationCommand:
          process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:creative-native-or-hybrid-plugin:j1"
      });

      console.log(`Creative native/hybrid plugin receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
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
