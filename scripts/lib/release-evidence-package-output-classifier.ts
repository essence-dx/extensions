import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { classifyArchivePackageContentWeakness } from "./package-artifact-content-proof.ts";
import {
  type ReceiptRecord,
  hasOnlyFalseReleaseClaims,
  hasSafePackageFileProof,
  isAdapterId,
  isNonEmptyString,
  isPositiveInteger,
  isSha256,
  readRecordArray,
  readRecordField,
  readStringArrayField
} from "./release-evidence-receipt-primitives.ts";
import { verifyPackageOutputReceipt } from "./package-output-proof.ts";
import {
  classifyPackageSourceInputWeakness
} from "./source-input-proof.ts";

const packageOutputReceiptTypes = new Set([
  "dx.extension.adobe_uxp.package_output",
  "dx.extension.affinity_content.content_package",
  "dx.extension.blender.package_output",
  "dx.extension.browser.package_output",
  "dx.extension.davinci_resolve.package_output",
  "dx.extension.figma_canva.package_output",
  "dx.extension.google_workspace.apps_script_package_output",
  "dx.extension.intellij_platform.package_output",
  "dx.extension.obsidian.package_output",
  "dx.extension.office_taskpane.package_output",
  "dx.extension.sketch.package_output",
  "dx.extension.unity_editor.package_output",
  "dx.extension.unreal_engine.package_output",
  "dx.extension.visual_studio.package_output",
  "dx.extension.vscode.package_output",
  "dx.extension.zed.package_output"
]);

export function classifyPackageOutputWeakness(
  kind: "package_output" | "content_package",
  receipt: ReceiptRecord | undefined
): string | undefined {
  if (!receipt) {
    return "package-output receipt is not a readable JSON object";
  }

  if (!packageOutputReceiptTypes.has(String(receipt.receipt))) {
    return "package-output receipt is not a recognized DX package-output receipt";
  }

  if (kind === "content_package" && receipt.receipt !== "dx.extension.affinity_content.content_package") {
    return "content-package evidence is not an Affinity content-package receipt";
  }

  if (!isAdapterId(receipt.adapterId) || !isNonEmptyString(receipt.host)) {
    return "package-output receipt is missing adapter or host identity";
  }

  const payload = readRecordField(receipt, "package") ?? readRecordField(receipt, "bundle");
  const payloadWeakness = classifyPackagePayloadWeakness(payload);

  if (payloadWeakness) {
    return payloadWeakness;
  }

  if (!hasOnlyFalseReleaseClaims(readRecordField(receipt, "releaseClaims"))) {
    return "package-output receipt contains true, missing, or non-false release claims";
  }

  const sourceInputWeakness = classifyPackageSourceInputWeakness(String(receipt.adapterId), receipt);

  if (sourceInputWeakness) {
    return sourceInputWeakness;
  }

  if (receipt.receipt === "dx.extension.affinity_content.content_package") {
    const affinityContentPackageWeakness = classifyAffinityContentPackageWeakness(receipt);

    if (affinityContentPackageWeakness) {
      return affinityContentPackageWeakness;
    }
  }

  if (receipt.receipt === "dx.extension.vscode.package_output") {
    const vsCodePackageWeakness = classifyVsixPackageOutputWeakness(
      receipt,
      "VS Code",
      "dx-vscode"
    );

    if (vsCodePackageWeakness) {
      return vsCodePackageWeakness;
    }
  }

  if (receipt.receipt === "dx.extension.visual_studio.package_output") {
    const visualStudioPackageWeakness = classifyVsixPackageOutputWeakness(
      receipt,
      "Visual Studio",
      "dx-visual-studio"
    );

    if (visualStudioPackageWeakness) {
      return visualStudioPackageWeakness;
    }
  }

  if (receipt.receipt === "dx.extension.browser.package_output") {
    const browserPackageWeakness = classifyBrowserPackageOutputWeakness(receipt);

    if (browserPackageWeakness) {
      return browserPackageWeakness;
    }
  }

  if (receipt.receipt === "dx.extension.intellij_platform.package_output") {
    const intellijPackageWeakness = classifyReleaseArchiveProofWeakness(receipt, {
      field: "gradlePluginPackage",
      hostLabel: "IntelliJ",
      proofLabel: "Gradle plugin ZIP",
      expectedExtension: ".zip",
      verifiedFlag: "zipHeaderVerified",
      expectedHeader: [0x50, 0x4b, 0x03, 0x04],
      archiveFormat: "zip"
    });

    if (intellijPackageWeakness) {
      return intellijPackageWeakness;
    }
  }

  if (receipt.receipt === "dx.extension.unity_editor.package_output") {
    const unityPackageWeakness = classifyReleaseArchiveProofWeakness(receipt, {
      field: "upmTarball",
      hostLabel: "Unity",
      proofLabel: "UPM tarball",
      expectedExtension: ".tgz",
      verifiedFlag: "gzipHeaderVerified",
      expectedHeader: [0x1f, 0x8b, 0x08],
      archiveFormat: "gzip-tarball"
    });

    if (unityPackageWeakness) {
      return unityPackageWeakness;
    }
  }

  if (receipt.receipt === "dx.extension.unreal_engine.package_output") {
    const unrealPackageWeakness = classifyReleaseArchiveProofWeakness(receipt, {
      field: "packagedPlugin",
      hostLabel: "Unreal",
      proofLabel: "packaged plugin ZIP",
      expectedExtension: ".zip",
      verifiedFlag: "zipHeaderVerified",
      expectedHeader: [0x50, 0x4b, 0x03, 0x04],
      archiveFormat: "zip"
    });

    if (unrealPackageWeakness) {
      return unrealPackageWeakness;
    }
  }

  try {
    verifyPackageOutputReceipt(String(receipt.adapterId), receipt);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return undefined;
}

function classifyBrowserPackageOutputWeakness(receipt: ReceiptRecord): string | undefined {
  const packagePayload = readRecordField(receipt, "package");
  const packageFiles = readRecordArray(packagePayload?.files);
  const packageFilesByPath = new Map(packageFiles.map((file) => [file.relativePath, file]));
  const targets = readRecordArray(receipt.targets);
  const targetsByName = new Map(targets.map((target) => [target.name, target]));

  for (const targetName of ["chromium", "edge", "firefox"]) {
    const target = targetsByName.get(targetName);
    const brandedIcon = readRecordField(target, "brandedIcon");
    const expectedIconPath = `${targetName}/static/dx.svg`;

    if (
      !brandedIcon ||
      brandedIcon.relativePath !== expectedIconPath ||
      !isSha256(brandedIcon.sha256)
    ) {
      return "browser package-output receipt is missing branded icon proof";
    }

    const packageFile = packageFilesByPath.get(expectedIconPath);

    if (!packageFile || packageFile.sha256 !== brandedIcon.sha256) {
      return "browser package-output branded icon proof does not match package files";
    }

    if (!hasSameStringSet(readStringArrayField(brandedIcon, "manifestReferences"), [
      "action.default_icon.128",
      "action.default_icon.16",
      "action.default_icon.48",
      "icons.128",
      "icons.16",
      "icons.48"
    ])) {
      return "browser package-output branded icon manifest references are incomplete";
    }
  }

  return undefined;
}

function classifyReleaseArchiveProofWeakness(
  receipt: ReceiptRecord,
  options: {
    field: string;
    hostLabel: string;
    proofLabel: string;
    expectedExtension: string;
    verifiedFlag: string;
    expectedHeader: number[];
    archiveFormat: "zip" | "gzip-tarball";
  }
): string | undefined {
  const artifact = readRecordField(receipt, options.field);

  if (!artifact) {
    return `${options.hostLabel} package-output receipt is missing ${options.proofLabel} proof`;
  }

  if (
    !isNonEmptyString(artifact.path) ||
    !isNonEmptyString(artifact.fileName) ||
    !artifact.fileName.endsWith(options.expectedExtension) ||
    !isPositiveInteger(artifact.bytes) ||
    !isSha256(artifact.sha256) ||
    artifact[options.verifiedFlag] !== true
  ) {
    return `${options.hostLabel} package-output ${options.proofLabel} proof is incomplete`;
  }

  if (!existsSync(artifact.path)) {
    return `${options.hostLabel} package-output ${options.proofLabel} file does not exist: ${artifact.path}`;
  }

  const bytes = readFileSync(artifact.path);

  if (bytes.length !== artifact.bytes) {
    return `${options.hostLabel} package-output ${options.proofLabel} file size changed`;
  }

  if (!headersEqual(Array.from(bytes.subarray(0, options.expectedHeader.length)), options.expectedHeader)) {
    return `${options.hostLabel} package-output ${options.proofLabel} file header changed`;
  }

  const actualSha256 = createHash("sha256").update(bytes).digest("hex");

  if (actualSha256 !== artifact.sha256) {
    return `${options.hostLabel} package-output ${options.proofLabel} file hash changed`;
  }

  const archiveContentWeakness = classifyArchivePackageContentWeakness(
    bytes,
    readRecordField(receipt, "package"),
    options.archiveFormat
  );

  return archiveContentWeakness
    ? `${options.hostLabel} package-output ${options.proofLabel} ${archiveContentWeakness}`
    : undefined;
}

function classifyPackagePayloadWeakness(payload: ReceiptRecord | undefined): string | undefined {
  if (!payload) {
    return "package-output receipt is missing package or bundle payload";
  }

  if (!isNonEmptyString(payload.root) || !isPositiveInteger(payload.fileCount) || !isSha256(payload.sha256)) {
    return "package-output payload is missing root, file count, or aggregate checksum";
  }

  const files = readRecordArray(payload.files);

  if (files.length === 0 || files.length !== payload.fileCount) {
    return "package-output payload file list does not match file count";
  }

  if (!files.every(hasSafePackageFileProof)) {
    return "package-output payload contains unsafe or incomplete file proof";
  }

  return undefined;
}

function classifyAffinityContentPackageWeakness(receipt: ReceiptRecord): string | undefined {
  if (receipt.adapterId !== "dx.affinity-content.bridge" || receipt.host !== "affinity") {
    return "Affinity content package is not linked to the Affinity content bridge";
  }

  const contentArtifacts = readRecordArray(receipt.contentArtifacts);

  if (contentArtifacts.length === 0 || !contentArtifacts.every(hasSafeAffinityContentArtifact)) {
    return "Affinity content package is missing importable content artifact proof";
  }

  const supportedHosts = readStringArrayField(receipt, "supportedHosts");
  const contentTypes = readStringArrayField(receipt, "contentTypes");

  if (supportedHosts.length === 0 || contentTypes.length === 0) {
    return "Affinity content package is missing supported host or content type proof";
  }

  return undefined;
}

function classifyVsixPackageOutputWeakness(
  receipt: ReceiptRecord,
  hostLabel: string,
  expectedFileNamePrefix: string
): string | undefined {
  const vsix = readRecordField(receipt, "vsix");

  if (!vsix) {
    return `${hostLabel} package-output receipt is missing VSIX package proof`;
  }

  if (
    !isNonEmptyString(vsix.path) ||
    !isNonEmptyString(vsix.fileName) ||
    !vsix.fileName.endsWith(".vsix") ||
    !vsix.fileName.startsWith(expectedFileNamePrefix) ||
    !isPositiveInteger(vsix.bytes) ||
    !isSha256(vsix.sha256) ||
    vsix.zipHeaderVerified !== true
  ) {
    return `${hostLabel} package-output VSIX proof is incomplete`;
  }

  if (!existsSync(vsix.path)) {
    return `${hostLabel} package-output VSIX file does not exist: ${vsix.path}`;
  }

  const bytes = readFileSync(vsix.path);

  if (bytes.length !== vsix.bytes) {
    return `${hostLabel} package-output VSIX file size changed`;
  }

  if (!headersEqual(Array.from(bytes.subarray(0, 4)), [0x50, 0x4b, 0x03, 0x04])) {
    return `${hostLabel} package-output VSIX file is not a ZIP archive`;
  }

  const actualSha256 = createHash("sha256").update(bytes).digest("hex");

  if (actualSha256 !== vsix.sha256) {
    return `${hostLabel} package-output VSIX file hash changed`;
  }

  const archiveContentWeakness = classifyArchivePackageContentWeakness(
    bytes,
    readRecordField(receipt, "package"),
    {
      allowAdditionalEntries: true,
      archiveFormat: "zip",
      caseInsensitivePaths: true,
      pathPrefixes: ["", "extension/"]
    }
  );

  return archiveContentWeakness
    ? `${hostLabel} package-output VSIX ${archiveContentWeakness}`
    : undefined;
}

function hasSafeAffinityContentArtifact(artifact: ReceiptRecord): boolean {
  return hasSafePackageFileProof(artifact) && isNonEmptyString(artifact.contentType);
}

function headersEqual(actual: number[], expected: number[]): boolean {
  return expected.every((value, index) => actual[index] === value);
}

function hasSameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}
