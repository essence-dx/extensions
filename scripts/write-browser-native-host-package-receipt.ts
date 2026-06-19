import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";
import {
  type EvidenceReceiptRequirement,
  parseEvidenceReceiptRequirement
} from "./release-evidence-requirements.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export type BrowserNativeHostPackageTarget = "chrome" | "edge" | "firefox";
export type BrowserNativeHostTargetOs = "windows" | "macos" | "linux";
export type BrowserNativeHostTargetArch = "x64" | "arm64";

export interface BrowserNativeHostPackageProof {
  targetOs: BrowserNativeHostTargetOs;
  targetArch: BrowserNativeHostTargetArch;
  hostName: string;
  nativeHostBinaryPath: string;
  packageOutputReceiptPath: string;
  extensionIdCaptureReceiptPath: string;
  manifestPaths: Record<BrowserNativeHostPackageTarget, string>;
}

export interface BrowserNativeHostPackageReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  receiptPath?: string;
  proof: BrowserNativeHostPackageProof;
}

export interface BrowserNativeHostPackageReceipt {
  receipt: "dx.extension.browser.native_host_package";
  adapterId: "dx.browser.command-center";
  host: "browser";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
    packageSha256: string;
    filesVerified: number;
  };
  extensionIdCapture: {
    receiptPath: string;
    receiptSha256: string;
    capturedTargets: ["chrome", "edge"];
    chromeExtensionId: string;
    edgeExtensionId: string;
  };
  nativeHost: {
    executable: {
      path: string;
      fileName: string;
      targetOs: BrowserNativeHostTargetOs;
      targetArch: BrowserNativeHostTargetArch;
      bytes: number;
      sha256: string;
    };
    manifests: BrowserNativeHostManifestReceipt[];
  };
  releaseClaims: {
    packageOutputVerified: true;
    nativeHostReleasePackageVerified: true;
    loadedChromeProfileVerified: false;
    loadedEdgeProfileVerified: false;
    loadedFirefoxProfileVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    storeDistributionVerified: false;
  };
}

export interface BrowserNativeHostManifestReceipt {
  target: BrowserNativeHostPackageTarget;
  manifestPath: string;
  sha256: string;
  name: string;
  type: "stdio";
  nativeHostPath: string;
  extensionId?: string;
  allowedOrigins?: string[];
  allowedExtensions?: string[];
}

interface ReleaseGateEntry {
  id: string;
  evidence_receipt_requirements: string[];
}

const adapterId = "dx.browser.command-center";
const manifestTargets: BrowserNativeHostPackageTarget[] = ["chrome", "edge", "firefox"];
const defaultReceiptRelativePath =
  ".dx/receipts/extensions/dx.browser.command-center/native-host-release-package-latest.json";

export function writeBrowserNativeHostPackageReceipt(
  root = process.cwd(),
  options: BrowserNativeHostPackageReceiptOptions
): BrowserNativeHostPackageReceipt {
  const workspaceRoot = resolve(root);
  const gateFailures = validateReleaseEvidenceGates(workspaceRoot);

  if (gateFailures.length > 0) {
    throw new Error(gateFailures.join("\n"));
  }

  const proof = validateProof(options.proof);
  const receiptPath = resolve(options.receiptPath ?? join(workspaceRoot, ...defaultReceiptRelativePath.split("/")));
  validateReleaseGateMapping(workspaceRoot, receiptPath);

  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const packageOutputReceipt = JSON.parse(packageOutputReceiptBytes.toString("utf8"));
  const packageOutput = verifyPackageOutputReceipt(adapterId, packageOutputReceipt);
  const firefoxExtensionId = readFirefoxExtensionIdFromPackageOutput(packageOutputReceipt);
  const extensionIdCapture = readExtensionIdCaptureReceipt(proof.extensionIdCaptureReceiptPath);
  const nativeHostBytes = readFileSync(proof.nativeHostBinaryPath);
  const manifests = manifestTargets.map((target) => readManifestReceipt(target, proof, firefoxExtensionId));
  validateCapturedChromiumExtensionIds(extensionIdCapture, manifests);
  const receipt: BrowserNativeHostPackageReceipt = {
    receipt: "dx.extension.browser.native_host_package",
    adapterId,
    host: "browser",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run package:browser-native-host:j1",
    receiptPath,
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutput.sha256,
      filesVerified: packageOutput.filesVerified
    },
    extensionIdCapture,
    nativeHost: {
      executable: {
        path: proof.nativeHostBinaryPath,
        fileName: basename(proof.nativeHostBinaryPath),
        targetOs: proof.targetOs,
        targetArch: proof.targetArch,
        bytes: nativeHostBytes.length,
        sha256: sha256(nativeHostBytes)
      },
      manifests
    },
    releaseClaims: {
      packageOutputVerified: true,
      nativeHostReleasePackageVerified: true,
      loadedChromeProfileVerified: false,
      loadedEdgeProfileVerified: false,
      loadedFirefoxProfileVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      storeDistributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_BROWSER_NATIVE_HOST_PACKAGE_PROOF_JSON;

    if (!proofPath) {
      throw new Error("DX_BROWSER_NATIVE_HOST_PACKAGE_PROOF_JSON must point to a browser native-host package proof JSON file.");
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proof = JSON.parse(readFileSync(proofPath, "utf8")) as BrowserNativeHostPackageProof;
    const receipt = writeBrowserNativeHostPackageReceipt(process.cwd(), {
      proof,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run package:browser-native-host:j1"
    });

    console.log(`Browser native-host package receipt written: ${receipt.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function validateProof(proof: BrowserNativeHostPackageProof): BrowserNativeHostPackageProof {
  if (!isRecord(proof)) {
    throw new Error("Browser native-host package proof must be an object.");
  }

  if (!["windows", "macos", "linux"].includes(proof.targetOs)) {
    throw new Error(`Browser native-host package target OS is unsupported: ${proof.targetOs}`);
  }

  if (!["x64", "arm64"].includes(proof.targetArch)) {
    throw new Error(`Browser native-host package target architecture is unsupported: ${proof.targetArch}`);
  }

  assertNonEmpty(proof.hostName, "host name");
  assertExistingAbsoluteFile(proof.nativeHostBinaryPath, "native-host executable");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.extensionIdCaptureReceiptPath, "extension ID capture receipt");
  assertNativeHostExecutableName(proof.nativeHostBinaryPath, proof.targetOs);

  if (!isRecord(proof.manifestPaths)) {
    throw new Error("Browser native-host package proof must include manifest paths.");
  }

  for (const target of manifestTargets) {
    assertExistingAbsoluteFile(proof.manifestPaths[target], `${target} native-host manifest`);
  }

  return proof;
}

function readExtensionIdCaptureReceipt(
  receiptPath: string
): BrowserNativeHostPackageReceipt["extensionIdCapture"] {
  const receiptBytes = readFileSync(receiptPath);
  const receipt = JSON.parse(receiptBytes.toString("utf8"));

  if (
    !isRecord(receipt) ||
    receipt.receipt !== "dx.extension.browser.extension_id_capture" ||
    receipt.adapterId !== adapterId ||
    receipt.host !== "browser"
  ) {
    throw new Error("Browser native-host package extension ID capture receipt is invalid.");
  }

  const captures = readCaptureExtensionIds(receipt.captures);
  const chromeExtensionId = captures.get("chrome");
  const edgeExtensionId = captures.get("edge");

  if (!chromeExtensionId || !edgeExtensionId) {
    throw new Error("Browser native-host package requires captured Chrome and Edge extension IDs.");
  }

  return {
    receiptPath,
    receiptSha256: sha256(receiptBytes),
    capturedTargets: ["chrome", "edge"],
    chromeExtensionId,
    edgeExtensionId
  };
}

function readCaptureExtensionIds(value: unknown): Map<"chrome" | "edge", string> {
  if (!Array.isArray(value)) {
    throw new Error("Browser native-host package extension ID capture receipt must include captures.");
  }

  const captures = new Map<"chrome" | "edge", string>();

  for (const capture of value) {
    if (!isRecord(capture) || (capture.target !== "chrome" && capture.target !== "edge")) {
      continue;
    }

    if (!isChromiumExtensionId(capture.extensionId)) {
      throw new Error(`Browser native-host package ${capture.target} extension ID capture is invalid.`);
    }

    captures.set(capture.target, capture.extensionId);
  }

  return captures;
}

function validateCapturedChromiumExtensionIds(
  extensionIdCapture: BrowserNativeHostPackageReceipt["extensionIdCapture"],
  manifests: BrowserNativeHostManifestReceipt[]
): void {
  const manifestByTarget = new Map(manifests.map((manifest) => [manifest.target, manifest]));
  const chromeOrigins = manifestByTarget.get("chrome")?.allowedOrigins ?? [];
  const edgeOrigins = manifestByTarget.get("edge")?.allowedOrigins ?? [];

  if (!chromeOrigins.includes(`chrome-extension://${extensionIdCapture.chromeExtensionId}/`)) {
    throw new Error("Browser native-host chrome manifest must match captured Chrome extension id.");
  }

  if (!edgeOrigins.includes(`chrome-extension://${extensionIdCapture.edgeExtensionId}/`)) {
    throw new Error("Browser native-host edge manifest must match captured Edge extension id.");
  }
}

function validateReleaseGateMapping(workspaceRoot: string, receiptPath: string): void {
  const receiptRelativePath = toWorkspaceRelativePath(workspaceRoot, receiptPath);
  const gate = readReleaseGateEntries(workspaceRoot).find((entry) => entry.id === adapterId);

  if (!gate) {
    throw new Error("Browser native-host package proof has no release evidence gate.");
  }

  const requirements = gate.evidence_receipt_requirements
    .map((requirement) => parseEvidenceReceiptRequirement(requirement))
    .filter((requirement): requirement is EvidenceReceiptRequirement => Boolean(requirement));
  const nativeHostPackageRequirement = requirements.find(
    (requirement) => requirement.kind === "native_host_package"
  );

  if (!nativeHostPackageRequirement || nativeHostPackageRequirement.receiptPath !== receiptRelativePath) {
    throw new Error("Browser native-host package receipt path must match the native_host_package release evidence gate.");
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

function readManifestReceipt(
  target: BrowserNativeHostPackageTarget,
  proof: BrowserNativeHostPackageProof,
  firefoxExtensionId: string
): BrowserNativeHostManifestReceipt {
  const manifestPath = proof.manifestPaths[target];
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));

  assertNativeHostManifestShape(target, manifest, proof);

  const receipt: BrowserNativeHostManifestReceipt = {
    target,
    manifestPath,
    sha256: sha256(manifestBytes),
    name: manifest.name,
    type: "stdio",
    nativeHostPath: manifest.path
  };

  if (target === "firefox") {
    receipt.allowedExtensions = readFirefoxAllowedExtensions(manifest.allowed_extensions, firefoxExtensionId);
    receipt.extensionId = firefoxExtensionId;
  } else {
    receipt.allowedOrigins = readStringArray(manifest.allowed_origins, `${target} allowed_origins`);
  }

  return receipt;
}

function readFirefoxExtensionIdFromPackageOutput(receipt: unknown): string {
  if (!isRecord(receipt) || !Array.isArray(receipt.targets)) {
    throw new Error("Browser native-host package output receipt must include browser targets.");
  }

  const firefoxTarget = receipt.targets.find((target) => isRecord(target) && target.name === "firefox");

  if (!isRecord(firefoxTarget)) {
    throw new Error("Browser native-host package output receipt is missing the Firefox target.");
  }

  if (typeof firefoxTarget.extensionId !== "string" || firefoxTarget.extensionId.trim() === "") {
    throw new Error("Browser native-host package output receipt is missing the packaged Firefox extension id.");
  }

  return firefoxTarget.extensionId.trim();
}

function assertNativeHostManifestShape(
  target: BrowserNativeHostPackageTarget,
  manifest: Record<string, unknown>,
  proof: BrowserNativeHostPackageProof
): void {
  if (!isRecord(manifest)) {
    throw new Error(`Browser native-host ${target} manifest must be an object.`);
  }

  if (manifest.name !== proof.hostName) {
    throw new Error(`Browser native-host ${target} manifest name must match ${proof.hostName}.`);
  }

  if (manifest.type !== "stdio") {
    throw new Error(`Browser native-host ${target} manifest type must be stdio.`);
  }

  if (manifest.path !== proof.nativeHostBinaryPath) {
    throw new Error(`Browser native-host ${target} manifest path must match the native-host executable.`);
  }

  if (target === "firefox") {
    assertFirefoxAllowedExtensions(manifest.allowed_extensions);
  } else {
    assertChromiumAllowedOrigins(target, manifest.allowed_origins);
  }
}

function assertChromiumAllowedOrigins(target: "chrome" | "edge", value: unknown): void {
  const origins = readStringArray(value, `${target} allowed_origins`);

  if (origins.length === 0) {
    throw new Error(`Browser native-host ${target} manifest must include allowed_origins.`);
  }

  for (const origin of origins) {
    if (origin.includes("{{") || !isChromiumExtensionOrigin(origin)) {
      throw new Error(`Browser native-host ${target} manifest must use explicit extension ids.`);
    }
  }
}

function assertFirefoxAllowedExtensions(value: unknown): void {
  const extensionIds = readStringArray(value, "firefox allowed_extensions");

  if (extensionIds.length === 0) {
    throw new Error("Browser native-host firefox manifest must include allowed_extensions.");
  }

  for (const extensionId of extensionIds) {
    if (extensionId.includes("{{") || !/^[A-Za-z0-9._@-]+$/.test(extensionId)) {
      throw new Error("Browser native-host firefox manifest must use explicit extension ids.");
    }
  }
}

function readFirefoxAllowedExtensions(value: unknown, extensionId: string): string[] {
  const extensionIds = readStringArray(value, "firefox allowed_extensions");

  if (extensionIds.length !== 1 || extensionIds[0] !== extensionId) {
    throw new Error("Browser native-host firefox manifest must match packaged Firefox extension id.");
  }

  return extensionIds;
}

function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`Browser native-host package ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`Browser native-host package ${label} does not exist: ${path}`);
  }
}

function assertNativeHostExecutableName(path: string, targetOs: BrowserNativeHostTargetOs): void {
  const fileName = basename(path);
  const expectedFileName = targetOs === "windows" ? "dx-browser-native-host.exe" : "dx-browser-native-host";

  if (fileName !== expectedFileName) {
    throw new Error(`Browser native-host executable must be named ${expectedFileName}.`);
  }
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error(`Browser native-host manifest ${label} must be a non-empty string array.`);
  }

  return value.map((entry) => entry.trim()).sort();
}

function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  const relativePath = relative(workspaceRoot, absolutePath).replace(/\\/g, "/");

  if (
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath) ||
    !relativePath.startsWith(".dx/receipts/extensions/")
  ) {
    throw new Error("Browser native-host package receipt path must stay under .dx/receipts/extensions.");
  }

  return relativePath;
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Browser native-host package ${label} is required.`);
  }
}

function isChromiumExtensionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-p]{32}$/.test(value);
}

function isChromiumExtensionOrigin(value: unknown): value is string {
  return typeof value === "string" && /^chrome-extension:\/\/[a-p]{32}\/$/.test(value);
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
