import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTomlDocument } from "./lib/toml-lite.ts";
import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { classifyIdeGameEngineLoadedHostWeakness } from "./lib/release-evidence-loaded-application-host-classifier.ts";
import {
  type IdeGameEnginePluginVerifierProof,
  type IdeGameEngineProjectEnablementProof,
  type IdeGameEngineProjectImportProof,
  type IdeGameEngineSpecialProof,
  type IdeGameEngineSpecialProofAdapterConfig,
  type IdeGameEngineSpecialProofKind,
  type IdeGameEngineSpecialProofReceipt,
  type IdeGameEngineSpecialProofReceiptBase,
  type IdeGameEngineSpecialProofReceiptOptions,
  ideGameEnginePrivacySensitiveProofKeys,
  ideGameEngineSpecialProofAdapterConfigs,
  ideGameEngineSpecialProofKeys,
  pluginVerifierProofKeys,
  projectEnablementProofKeys,
  projectImportProofKeys,
  releaseGatesRelativePath
} from "./lib/ide-game-engine-special-proof-model.ts";
import { parseEvidenceReceiptRequirement } from "./release-evidence-requirements.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export function writeIdeGameEngineSpecialProofReceipt(
  root = process.cwd(),
  options: IdeGameEngineSpecialProofReceiptOptions
): IdeGameEngineSpecialProofReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(options.proof);
  const config = ideGameEngineSpecialProofAdapterConfigs[proof.target];
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const packageOutputReceipt = JSON.parse(packageOutputReceiptBytes.toString("utf8"));
  const packageOutputProof = verifyPackageOutputReceipt(config.adapterId, packageOutputReceipt);
  const loadedHostReceiptBytes = readFileSync(proof.loadedHostReceiptPath);
  parseLoadedHostReceipt(loadedHostReceiptBytes, config);
  const proofFileBytes = readFileSync(proof.proofFilePath);

  if (packageOutputReceipt.receipt !== config.packageOutputReceipt) {
    throw new Error(`IDE/game-engine special proof package output type mismatch for ${config.adapterId}.`);
  }

  if (packageOutputProof.host !== config.expectedHost) {
    throw new Error(`IDE/game-engine special proof package output host mismatch for ${config.adapterId}.`);
  }

  const receiptPath = resolveReleaseGateReceiptPath(workspaceRoot, config);
  const baseReceipt = createBaseReceipt(
    config,
    proof,
    packageOutputReceiptBytes,
    packageOutputProof,
    loadedHostReceiptBytes,
    proofFileBytes,
    receiptPath,
    {
      generatedAt: options.generatedAt,
      verificationCommand: options.verificationCommand
    }
  );
  const receipt = createReceipt(config, proof, packageOutputReceipt, baseReceipt);

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

export function writeIdeGameEngineSpecialProofReceipts(
  root = process.cwd(),
  options: Omit<IdeGameEngineSpecialProofReceiptOptions, "proof"> & {
    proof: IdeGameEngineSpecialProof | IdeGameEngineSpecialProof[];
  }
): IdeGameEngineSpecialProofReceipt[] {
  const proofs = Array.isArray(options.proof) ? options.proof : [options.proof];

  return proofs.map((proof) =>
    writeIdeGameEngineSpecialProofReceipt(root, {
      generatedAt: options.generatedAt,
      verificationCommand: options.verificationCommand,
      proof
    })
  );
}

if (isDirectRun()) {
  try {
    const proofPath = process.env.DX_IDE_GAME_ENGINE_SPECIAL_PROOF_JSON;

    if (!proofPath) {
      throw new Error(
        "DX_IDE_GAME_ENGINE_SPECIAL_PROOF_JSON must point to an IDE/game-engine special proof JSON file."
      );
    }

    assertExistingAbsoluteFile(proofPath, "proof JSON");
    const proofSource = JSON.parse(readFileSync(proofPath, "utf8")) as
      | IdeGameEngineSpecialProof
      | IdeGameEngineSpecialProof[];
    const receipts = writeIdeGameEngineSpecialProofReceipts(process.cwd(), {
      proof: proofSource,
      verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run smoke:ide-game-engine-special-proof:j1"
    });

    for (const receipt of receipts) {
      console.log(`${receipt.adapterId} ${receipt.proofKind} receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function createBaseReceipt(
  config: IdeGameEngineSpecialProofAdapterConfig,
  proof: IdeGameEngineSpecialProof,
  packageOutputReceiptBytes: Buffer,
  packageOutputProof: ReturnType<typeof verifyPackageOutputReceipt>,
  loadedHostReceiptBytes: Buffer,
  proofFileBytes: Buffer,
  receiptPath: string,
  options: Pick<IdeGameEngineSpecialProofReceiptOptions, "generatedAt" | "verificationCommand">
): Omit<IdeGameEngineSpecialProofReceiptBase, "receipt" | "proofKind" | "adapterId" | "host"> {
  return {
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: options.verificationCommand ?? "npm run smoke:ide-game-engine-special-proof:j1",
    receiptPath,
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: sha256(packageOutputReceiptBytes),
      packageSha256: packageOutputProof.sha256,
      filesVerified: packageOutputProof.filesVerified
    },
    loadedHostReceiptPath: proof.loadedHostReceiptPath,
    loadedHostReceiptSha256: sha256(loadedHostReceiptBytes),
    manualProof: {
      proofFilePath: proof.proofFilePath,
      proofFileSha256: sha256(proofFileBytes)
    },
    releaseClaims: {
      packageOutputVerified: true,
      loadedHostVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      distributionVerified: false,
      marketplaceReviewVerified: false,
      pluginVerifierVerified: config.proofKind === "plugin_verifier",
      projectImportVerified: config.proofKind === "project_import",
      projectEnablementVerified: config.proofKind === "project_enablement"
    }
  };
}

function createReceipt(
  config: IdeGameEngineSpecialProofAdapterConfig,
  proof: IdeGameEngineSpecialProof,
  packageOutputReceipt: Record<string, unknown>,
  baseReceipt: Omit<IdeGameEngineSpecialProofReceiptBase, "receipt" | "proofKind" | "adapterId" | "host">
): IdeGameEngineSpecialProofReceipt {
  const common = {
    adapterId: config.adapterId,
    host: config.expectedHost,
    ...baseReceipt
  };

  if (config.proofKind === "plugin_verifier") {
    const pluginVerifier = expectPluginVerifierProof(proof);

    return {
      receipt: config.receipt,
      proofKind: "plugin_verifier",
      ...common,
      pluginVerifier: {
        toolName: "JetBrains Plugin Verifier",
        toolVersion: pluginVerifier.toolVersion.trim(),
        ideVersions: uniqueSorted(pluginVerifier.ideVersions),
        compatible: true,
        problems: [],
        warnings: uniqueSorted(pluginVerifier.warnings)
      }
    };
  }

  if (config.proofKind === "project_import") {
    const projectImport = expectProjectImportProof(proof, packageOutputReceipt);

    return {
      receipt: config.receipt,
      proofKind: "project_import",
      ...common,
      projectImport: {
        unityVersion: projectImport.unityVersion.trim(),
        packageName: projectImport.packageName.trim(),
        packageVersion: projectImport.packageVersion.trim(),
        testProjectKind: "empty-project",
        imported: true,
        compileStatus: "passed",
        editorTestsStatus: "passed",
        assetDatabaseRefreshed: true,
        mutatesProjectAssets: false
      }
    };
  }

  const projectEnablement = expectProjectEnablementProof(proof, packageOutputReceipt);

  return {
    receipt: config.receipt,
    proofKind: "project_enablement",
    ...common,
    projectEnablement: {
      engineVersion: projectEnablement.engineVersion.trim(),
      pluginModuleName: projectEnablement.pluginModuleName.trim(),
      testProjectKind: "empty-sample-project",
      pluginEnabled: true,
      editorModuleLoaded: true,
      automationTestsStatus: "passed",
      mutatesProjectContent: false
    }
  };
}

function validateProof(proof: IdeGameEngineSpecialProof): IdeGameEngineSpecialProof {
  if (!isRecord(proof)) {
    throw new Error("IDE/game-engine special proof must be an object.");
  }

  rejectPrivacySensitiveKeys(proof);
  rejectUnexpectedKeys(proof, ideGameEngineSpecialProofKeys, "IDE/game-engine special proof");

  if (!Object.hasOwn(ideGameEngineSpecialProofAdapterConfigs, proof.target)) {
    throw new Error(`Unsupported IDE/game-engine special proof target: ${proof.target}`);
  }

  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.loadedHostReceiptPath, "loaded-host receipt");
  assertExistingAbsoluteFile(proof.proofFilePath, "proof file");

  const config = ideGameEngineSpecialProofAdapterConfigs[proof.target];
  const proofBlocks = [
    proof.pluginVerifier ? "plugin_verifier" : undefined,
    proof.projectImport ? "project_import" : undefined,
    proof.projectEnablement ? "project_enablement" : undefined
  ].filter((kind): kind is IdeGameEngineSpecialProofKind => Boolean(kind));

  if (proofBlocks.length !== 1 || proofBlocks[0] !== config.proofKind) {
    throw new Error(`IDE/game-engine special proof for ${config.adapterId} must include only ${config.proofKind}.`);
  }

  return proof;
}

function parseLoadedHostReceipt(
  loadedHostReceiptBytes: Buffer,
  config: IdeGameEngineSpecialProofAdapterConfig
): void {
  let loadedHostReceipt: unknown;

  try {
    loadedHostReceipt = JSON.parse(loadedHostReceiptBytes.toString("utf8"));
  } catch {
    throw new Error(`IDE/game-engine special proof loaded-host receipt is not readable JSON for ${config.adapterId}.`);
  }

  if (!isRecord(loadedHostReceipt)) {
    throw new Error(`IDE/game-engine special proof loaded-host receipt must be an object for ${config.adapterId}.`);
  }

  if (loadedHostReceipt.adapterId !== config.adapterId || loadedHostReceipt.host !== config.expectedHost) {
    throw new Error(`IDE/game-engine special proof loaded-host receipt identity mismatch for ${config.adapterId}.`);
  }

  const loadedHostWeakness = classifyIdeGameEngineLoadedHostWeakness(loadedHostReceipt);

  if (loadedHostWeakness) {
    throw new Error(
      `IDE/game-engine special proof loaded-host receipt is weak for ${config.adapterId}: ${loadedHostWeakness}`
    );
  }

}

function expectPluginVerifierProof(proof: IdeGameEngineSpecialProof): IdeGameEnginePluginVerifierProof {
  const pluginVerifier = proof.pluginVerifier;

  if (!isRecord(pluginVerifier)) {
    throw new Error("IDE/game-engine special proof must include Plugin Verifier proof.");
  }

  rejectUnexpectedKeys(pluginVerifier, pluginVerifierProofKeys, "Plugin Verifier proof");
  assertNonEmpty(pluginVerifier.toolVersion, "Plugin Verifier tool version");
  const ideVersions = expectStringArray(pluginVerifier.ideVersions, "Plugin Verifier IDE versions");

  if (ideVersions.length === 0) {
    throw new Error("Plugin Verifier proof must include at least one IDE version.");
  }

  if (pluginVerifier.compatible !== true) {
    throw new Error("Plugin Verifier proof must mark the plugin compatible.");
  }

  const problems = expectStringArray(pluginVerifier.problems, "Plugin Verifier problems");

  if (problems.length > 0) {
    throw new Error("Plugin Verifier proof must have zero Plugin Verifier problems.");
  }

  return {
    toolVersion: pluginVerifier.toolVersion,
    ideVersions,
    compatible: true,
    problems: [],
    warnings: expectStringArray(pluginVerifier.warnings, "Plugin Verifier warnings")
  };
}

function expectProjectImportProof(
  proof: IdeGameEngineSpecialProof,
  packageOutputReceipt: Record<string, unknown>
): IdeGameEngineProjectImportProof {
  const projectImport = proof.projectImport;

  if (!isRecord(projectImport)) {
    throw new Error("IDE/game-engine special proof must include Unity project import proof.");
  }

  rejectUnexpectedKeys(projectImport, projectImportProofKeys, "Unity project import proof");
  assertNonEmpty(projectImport.unityVersion, "Unity version");
  assertNonEmpty(projectImport.packageName, "Unity package name");
  assertNonEmpty(projectImport.packageVersion, "Unity package version");

  if (projectImport.testProjectKind !== "empty-project") {
    throw new Error("Unity project import proof must use an empty test project.");
  }

  if (projectImport.imported !== true) {
    throw new Error("Unity project import proof must import the package.");
  }

  if (projectImport.compileStatus !== "passed" || projectImport.editorTestsStatus !== "passed") {
    throw new Error("Unity project import proof must pass compile and editor tests.");
  }

  if (projectImport.assetDatabaseRefreshed !== true) {
    throw new Error("Unity project import proof must refresh the AssetDatabase.");
  }

  if (projectImport.mutatesProjectAssets !== false) {
    throw new Error("Unity project import proof must not mutate test project assets.");
  }

  const packageManifest = readRecordField(packageOutputReceipt, "packageManifest");

  if (
    packageManifest?.name !== projectImport.packageName ||
    packageManifest.version !== projectImport.packageVersion
  ) {
    throw new Error("Unity project import proof must match package output manifest name and version.");
  }

  return {
    unityVersion: projectImport.unityVersion,
    packageName: projectImport.packageName,
    packageVersion: projectImport.packageVersion,
    testProjectKind: "empty-project",
    imported: true,
    compileStatus: "passed",
    editorTestsStatus: "passed",
    assetDatabaseRefreshed: true,
    mutatesProjectAssets: false
  };
}

function expectProjectEnablementProof(
  proof: IdeGameEngineSpecialProof,
  packageOutputReceipt: Record<string, unknown>
): IdeGameEngineProjectEnablementProof {
  const projectEnablement = proof.projectEnablement;

  if (!isRecord(projectEnablement)) {
    throw new Error("IDE/game-engine special proof must include Unreal project enablement proof.");
  }

  rejectUnexpectedKeys(projectEnablement, projectEnablementProofKeys, "Unreal project enablement proof");
  assertNonEmpty(projectEnablement.engineVersion, "Unreal Engine version");
  assertNonEmpty(projectEnablement.pluginModuleName, "Unreal plugin module name");

  if (projectEnablement.testProjectKind !== "empty-sample-project") {
    throw new Error("Unreal project enablement proof must use an empty sample project.");
  }

  if (projectEnablement.pluginEnabled !== true) {
    throw new Error("Unreal project enablement proof must enable the Unreal plugin.");
  }

  if (projectEnablement.editorModuleLoaded !== true) {
    throw new Error("Unreal project enablement proof must load the editor module.");
  }

  if (projectEnablement.automationTestsStatus !== "passed") {
    throw new Error("Unreal project enablement proof must pass automation tests.");
  }

  if (projectEnablement.mutatesProjectContent !== false) {
    throw new Error("Unreal project enablement proof must not mutate project content.");
  }

  const pluginDescriptor = readRecordField(packageOutputReceipt, "pluginDescriptor");

  if (pluginDescriptor?.moduleName !== projectEnablement.pluginModuleName) {
    throw new Error("Unreal project enablement proof must match package output plugin module name.");
  }

  return {
    engineVersion: projectEnablement.engineVersion,
    pluginModuleName: projectEnablement.pluginModuleName,
    testProjectKind: "empty-sample-project",
    pluginEnabled: true,
    editorModuleLoaded: true,
    automationTestsStatus: "passed",
    mutatesProjectContent: false
  };
}

function resolveReleaseGateReceiptPath(
  workspaceRoot: string,
  config: IdeGameEngineSpecialProofAdapterConfig
): string {
  const failures = validateReleaseEvidenceGates(workspaceRoot);

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);
  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));
  const gate = (releaseGates.arrays.extensions ?? []).find((entry) => entry.id === config.adapterId);

  if (!gate || !Array.isArray(gate.evidence_receipt_requirements)) {
    throw new Error(`Release evidence gate is missing for ${config.adapterId}.`);
  }

  const requirement = gate.evidence_receipt_requirements
    .map((value) => parseEvidenceReceiptRequirement(value))
    .find((candidate) => candidate?.kind === config.proofKind);

  if (!requirement) {
    throw new Error(`Release evidence gate for ${config.adapterId} must map ${config.proofKind}.`);
  }

  return join(workspaceRoot, ...requirement.receiptPath.split("/"));
}

function rejectPrivacySensitiveKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      rejectPrivacySensitiveKeys(item);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (ideGameEnginePrivacySensitiveProofKeys.has(key)) {
      throw new Error(`IDE/game-engine special proof contains privacy-sensitive field: ${key}`);
    }

    rejectPrivacySensitiveKeys(child);
  }
}

function rejectUnexpectedKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${label} contains an unsupported field: ${key}`);
    }
  }
}

function assertExistingAbsoluteFile(path: unknown, label: string): asserts path is string {
  if (typeof path !== "string" || path.trim() === "") {
    throw new Error(`IDE/game-engine special proof ${label} must be an absolute path.`);
  }

  if (!isAbsolute(path)) {
    throw new Error(`IDE/game-engine special proof ${label} must be an absolute path.`);
  }

  if (!existsSync(path)) {
    throw new Error(`IDE/game-engine special proof ${label} does not exist: ${path}`);
  }
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`IDE/game-engine special proof ${label} is required.`);
  }
}

function expectStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim() !== "")) {
    throw new Error(`IDE/game-engine special proof ${label} must be an array of non-empty strings.`);
  }

  return value;
}

function readRecordField(
  value: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const field = value[key];

  return isRecord(field) ? field : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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
