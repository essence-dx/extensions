import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPackageOutputReceipt } from "./lib/package-output-proof.ts";
import { parseTomlDocument } from "./lib/toml-lite.ts";
import { classifyCoreEvidenceWeakness } from "./lib/release-evidence-core-classifiers.ts";
import {
  type ReleaseEvidenceEnvironmentSummary,
  readReleaseEvidenceEnvironmentSummary
} from "./lib/release-evidence-environment-summary.ts";
import {
  classifyCurrentSha256FileProofWeakness,
  classifyLinkedPackageOutputWeakness,
  classifyLinkedReceiptWeakness,
  classifyManualProofWeakness
} from "./lib/release-evidence-linked-proof-freshness.ts";
import { classifyOfficeLocalServiceWeakness } from "./lib/release-evidence-productivity-host-classifier.ts";
import {
  type ReleaseEvidenceRemediationSummary,
  type ReleaseEvidenceRequirementRemediation,
  deriveReleaseEvidenceRequirementRemediation,
  summarizeReleaseEvidenceRemediations
} from "./lib/release-evidence-remediation.ts";
import {
  type EvidenceReceiptRequirement,
  groupEvidenceReceiptRequirements,
  parseEvidenceReceiptRequirement
} from "./release-evidence-requirements.ts";
import { validateReleaseEvidenceGates } from "./validate-release-evidence-gates.ts";

export interface ReleaseEvidenceGapReportOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
}

export interface ReleaseEvidenceGapReport {
  receipt: "dx.extension.release_evidence_gap_report";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  summary: {
    releaseGateEntries: number;
    expectedReceiptCount: number;
    existingReceiptCount: number;
    missingReceiptCount: number;
    expectedUniqueReceiptCount: number;
    existingUniqueReceiptCount: number;
    missingUniqueReceiptCount: number;
    expectedEvidenceCount: number;
    existingEvidenceCount: number;
    missingEvidenceCount: number;
    weakEvidenceCount: number;
    weakReceiptCount: number;
    weakUniqueReceiptCount: number;
    environmentBlockerCount: number;
    releaseReady: number;
  };
  remediation: ReleaseEvidenceRemediationSummary;
  extensions: ReleaseEvidenceGapEntry[];
}

export interface ReleaseEvidenceGapEntry {
  id: string;
  stage: string;
  requiredEvidence: string[];
  expectedReceiptCount: number;
  existingReceiptCount: number;
  missingReceiptCount: number;
  expectedUniqueReceiptCount: number;
  existingUniqueReceiptCount: number;
  missingUniqueReceiptCount: number;
  weakReceiptCount: number;
  weakUniqueReceiptCount: number;
  expectedEvidenceCount: number;
  existingEvidenceCount: number;
  missingEvidenceCount: number;
  weakEvidenceCount: number;
  evidenceRequirements: ReleaseEvidenceRequirementEntry[];
  existingEvidence: string[];
  missingEvidence: string[];
  weakEvidence: string[];
  existingReceipts: string[];
  missingReceipts: string[];
  weakReceipts: string[];
  environment: ReleaseEvidenceEnvironmentSummary;
  releaseReady: boolean;
  nextReleaseProof: string;
  blockedBy: string[];
}

interface ReleaseGateEntry {
  id: string;
  stage: string;
  required_evidence: string[];
  evidence_receipt_requirements: string[];
  evidence_receipts: string[];
  next_release_proof: string;
  blocked_by: string[];
}

export interface ReleaseEvidenceRequirementEntry {
  kind: string;
  receiptPath: string;
  exists: boolean;
  releaseValid: boolean;
  weakness?: string;
  remediation?: ReleaseEvidenceRequirementRemediation;
}

const releaseGatesRelativePath = "registry/release-evidence-gates.toml";
const gapReportReceiptPath = ".dx/receipts/extensions/release-evidence-gaps-latest.json";
const reviewEvidenceKinds = new Set([
  "distribution_review",
  "marketplace_review",
  "community_review",
  "canva_review",
  "appsource_review",
  "gallery_review",
  "oauth_review"
]);
const browserCommandCenterAdapterId = "dx.browser.command-center";
const requiredBrowserStoreTargets = [
  "chrome_web_store",
  "edge_add_ons",
  "firefox_amo"
];
const adobeCcxPackageConfigs: Record<
  string,
  {
    artifactFileName: string;
    host: string;
    hostApp: string;
    manifestId: string;
  }
> = {
  "dx.photoshop.command-center": {
    artifactFileName: "dx-command-center.ccx",
    host: "photoshop",
    hostApp: "PS",
    manifestId: "dx.photoshop.command-center.development"
  },
  "dx.premiere-pro.command-center": {
    artifactFileName: "dx-command-center.ccx",
    host: "premiere-pro",
    hostApp: "premierepro",
    manifestId: "dx.premiere-pro.command-center.development"
  },
  "dx.indesign.command-center": {
    artifactFileName: "dx-command-center.ccx",
    host: "indesign",
    hostApp: "ID",
    manifestId: "dx.indesign.command-center.development"
  }
};

export function writeReleaseEvidenceGapReport(
  root = process.cwd(),
  options: ReleaseEvidenceGapReportOptions = {}
): ReleaseEvidenceGapReport {
  const workspaceRoot = resolve(root);
  const failures = validateReleaseEvidenceGates(workspaceRoot);

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const verificationCommand = options.verificationCommand ?? "npm run report:release-evidence-gaps:j1";
  const entries = readReleaseGateEntries(workspaceRoot);
  const extensions = entries.map((entry) => createGapEntry(workspaceRoot, entry));
  const receiptPath = join(workspaceRoot, ...gapReportReceiptPath.split("/"));
  const report: ReleaseEvidenceGapReport = {
    receipt: "dx.extension.release_evidence_gap_report",
    generatedAt,
    verificationCommand,
    receiptPath,
    summary: {
      releaseGateEntries: extensions.length,
      expectedReceiptCount: sum(extensions, "expectedReceiptCount"),
      existingReceiptCount: sum(extensions, "existingReceiptCount"),
      missingReceiptCount: sum(extensions, "missingReceiptCount"),
      expectedUniqueReceiptCount: sum(extensions, "expectedUniqueReceiptCount"),
      existingUniqueReceiptCount: sum(extensions, "existingUniqueReceiptCount"),
      missingUniqueReceiptCount: sum(extensions, "missingUniqueReceiptCount"),
      expectedEvidenceCount: sum(extensions, "expectedEvidenceCount"),
      existingEvidenceCount: sum(extensions, "existingEvidenceCount"),
      missingEvidenceCount: sum(extensions, "missingEvidenceCount"),
      weakEvidenceCount: sum(extensions, "weakEvidenceCount"),
      weakReceiptCount: sum(extensions, "weakReceiptCount"),
      weakUniqueReceiptCount: sum(extensions, "weakUniqueReceiptCount"),
      environmentBlockerCount: countEnvironmentBlockers(extensions),
      releaseReady: extensions.filter((extension) => extension.releaseReady).length
    },
    remediation: summarizeReleaseEvidenceRemediations(extensions),
    extensions
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(report, null, 2)}\n`);

  return report;
}

if (isDirectRun()) {
  const report = writeReleaseEvidenceGapReport(process.cwd(), {
    verificationCommand: process.env.DX_VERIFICATION_COMMAND ?? "npm run report:release-evidence-gaps:j1"
  });

  console.log(
    `Release evidence gap report written: ${report.summary.missingReceiptCount} missing receipt obligations, ${report.summary.missingUniqueReceiptCount} missing unique receipt paths, ${report.summary.weakReceiptCount} weak receipt obligations`
  );
}

function readReleaseGateEntries(workspaceRoot: string): ReleaseGateEntry[] {
  const releaseGatesPath = join(workspaceRoot, releaseGatesRelativePath);
  const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));

  return (releaseGates.arrays.extensions ?? [])
    .map((entry) => ({
      id: entry.id,
      stage: entry.stage,
      required_evidence: entry.required_evidence,
      evidence_receipt_requirements: entry.evidence_receipt_requirements,
      evidence_receipts: entry.evidence_receipts,
      next_release_proof: entry.next_release_proof,
      blocked_by: entry.blocked_by
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function createGapEntry(workspaceRoot: string, entry: ReleaseGateEntry): ReleaseEvidenceGapEntry {
  const receiptRequirements = entry.evidence_receipt_requirements
    .map((requirement) => parseEvidenceReceiptRequirement(requirement))
    .filter((requirement): requirement is EvidenceReceiptRequirement => Boolean(requirement));
  const evidenceRequirements = receiptRequirements.map((requirement) =>
    createRequirementEntry(workspaceRoot, entry.id, requirement)
  );
  const existingReceiptRequirements = evidenceRequirements.filter((requirement) => requirement.exists);
  const missingReceiptRequirements = evidenceRequirements.filter((requirement) => !requirement.exists);
  const weakReceiptRequirements = evidenceRequirements.filter(
    (requirement) => requirement.exists && !requirement.releaseValid
  );
  const existingReceipts = uniqueSorted(existingReceiptRequirements.map((requirement) => requirement.receiptPath));
  const missingReceipts = uniqueSorted(missingReceiptRequirements.map((requirement) => requirement.receiptPath));
  const weakReceipts = uniqueSorted(weakReceiptRequirements.map((requirement) => requirement.receiptPath));
  const evidenceRequirementsByKind = groupEvidenceReceiptRequirements(
    evidenceRequirements.map((requirement) => ({
      kind: requirement.kind,
      receiptPath: requirement.receiptPath
    }))
  );
  const existingEvidence = entry.required_evidence
    .filter((kind) => evidenceRequirementsByKind.get(kind)?.every((requirement) =>
      evidenceRequirements.some(
        (candidate) =>
          candidate.kind === requirement.kind &&
          candidate.receiptPath === requirement.receiptPath &&
          candidate.exists &&
          candidate.releaseValid
      )
    ))
    .sort();
  const missingEvidence = entry.required_evidence
    .filter((kind) => !existingEvidence.includes(kind))
    .sort();
  const weakEvidence = entry.required_evidence
    .filter((kind) => {
      const requirements = evidenceRequirementsByKind.get(kind) ?? [];

      return requirements.some((requirement) =>
        evidenceRequirements.some(
          (candidate) =>
            candidate.kind === requirement.kind &&
            candidate.receiptPath === requirement.receiptPath &&
            candidate.exists &&
            !candidate.releaseValid
        )
      );
    })
    .sort();
  const environment = readReleaseEvidenceEnvironmentSummary(workspaceRoot, entry.id, {
    releaseValidEvidenceKinds: existingEvidence
  });

  return {
    id: entry.id,
    stage: entry.stage,
    requiredEvidence: [...entry.required_evidence],
    expectedReceiptCount: evidenceRequirements.length,
    existingReceiptCount: existingReceiptRequirements.length,
    missingReceiptCount: missingReceiptRequirements.length,
    weakReceiptCount: weakReceiptRequirements.length,
    expectedUniqueReceiptCount: uniqueSorted(evidenceRequirements.map((requirement) => requirement.receiptPath))
      .length,
    existingUniqueReceiptCount: existingReceipts.length,
    missingUniqueReceiptCount: missingReceipts.length,
    weakUniqueReceiptCount: weakReceipts.length,
    expectedEvidenceCount: entry.required_evidence.length,
    existingEvidenceCount: existingEvidence.length,
    missingEvidenceCount: missingEvidence.length,
    weakEvidenceCount: weakEvidence.length,
    evidenceRequirements,
    existingEvidence,
    missingEvidence,
    weakEvidence,
    existingReceipts,
    missingReceipts,
    weakReceipts,
    environment,
    releaseReady:
      entry.stage === "release-ready" &&
      missingReceiptRequirements.length === 0 &&
      weakReceiptRequirements.length === 0 &&
      missingEvidence.length === 0 &&
      environment.blockers.length === 0,
    nextReleaseProof: entry.next_release_proof,
    blockedBy: deriveReleaseBlockers(entry.stage, evidenceRequirements, environment.blockers)
  };
}

function deriveReleaseBlockers(
  stage: string,
  requirements: ReleaseEvidenceRequirementEntry[],
  environmentBlockers: string[]
): string[] {
  const evidenceBlockers = requirements
    .filter((requirement) => !requirement.exists || !requirement.releaseValid)
    .map(formatReleaseBlocker);
  const blockers = [
    ...evidenceBlockers,
    ...environmentBlockers.map((blocker) => `environment blocker: ${blocker}`)
  ];

  if (blockers.length > 0) {
    return uniqueSorted(blockers);
  }

  return stage === "release-ready" ? [] : [`stage is ${stage}`];
}

function formatReleaseBlocker(requirement: ReleaseEvidenceRequirementEntry): string {
  const status = requirement.exists ? "weak" : "missing";
  const weakness = requirement.weakness ? `: ${requirement.weakness}` : "";

  return `${status} ${requirement.kind} receipt (${requirement.receiptPath})${weakness}`;
}

function createRequirementEntry(
  workspaceRoot: string,
  expectedAdapterId: string,
  requirement: EvidenceReceiptRequirement
): ReleaseEvidenceRequirementEntry {
  const absolutePath = join(workspaceRoot, ...requirement.receiptPath.split("/"));
  const exists = existsSync(absolutePath);
  const remediation = deriveReleaseEvidenceRequirementRemediation(expectedAdapterId, requirement);

  if (!exists) {
    return {
      kind: requirement.kind,
      receiptPath: requirement.receiptPath,
      exists: false,
      releaseValid: false,
      ...(remediation ? { remediation } : {})
    };
  }

  const weakness = classifyWeakness(
    requirement.kind,
    absolutePath,
    expectedAdapterId,
    workspaceRoot,
    requirement.receiptPath
  );

  return {
    kind: requirement.kind,
    receiptPath: requirement.receiptPath,
    exists: true,
    releaseValid: weakness === undefined,
    ...(weakness ? { weakness } : {}),
    ...(weakness && remediation ? { remediation } : {})
  };
}

function classifyWeakness(
  kind: string,
  absolutePath: string,
  expectedAdapterId: string,
  workspaceRoot: string,
  requiredReceiptPath?: string
): string | undefined {
  const receipt = readReceiptObject(absolutePath);
  const checksum = readRecordField(receipt, "checksum");
  const releaseClaims = readRecordField(receipt, "releaseClaims");
  const adapterWeakness = classifyExpectedAdapterWeakness(receipt, expectedAdapterId);

  if (adapterWeakness) {
    return adapterWeakness;
  }

  const coreEvidenceWeakness = classifyCoreEvidenceWeakness(kind, receipt);

  if (coreEvidenceWeakness) {
    return coreEvidenceWeakness;
  }

  const browserLoadedProfileTargetWeakness = classifyBrowserLoadedProfileRequiredTargetWeakness(
    kind,
    receipt,
    requiredReceiptPath
  );

  if (browserLoadedProfileTargetWeakness) {
    return browserLoadedProfileTargetWeakness;
  }

  if (kind === "checksum") {
    if (checksum?.scope === "package-output") {
      return "package-output checksum is not public release artifact checksum";
    }

    if (receipt?.receipt !== "dx.extension.release_package.checksum") {
      return "checksum receipt is not a release package checksum receipt";
    }

    if (checksum?.algorithm !== "sha256") {
      return "checksum receipt does not use sha256";
    }

    if (checksum.scope !== "public-release-package") {
      return "checksum receipt does not verify a public release package";
    }

    if (
      releaseClaims?.publicReleasePackageVerified !== true ||
      releaseClaims.releaseChecksumVerified !== true
    ) {
      return "checksum receipt does not verify a public release package";
    }

    const packageOutput = readRecordField(receipt, "packageOutput");
    const releaseArtifact = readRecordField(receipt, "releaseArtifact");

    if (!isSha256(packageOutput?.packageOutputSha256)) {
      return "checksum receipt is missing package output checksum linkage";
    }

    const linkedPackageOutputWeakness = classifyChecksumLinkedPackageOutputWeakness(packageOutput);

    if (linkedPackageOutputWeakness) {
      return linkedPackageOutputWeakness;
    }

    if (releaseArtifact?.createdFromPackageOutput !== true) {
      return "checksum receipt does not link release artifact to package output";
    }

    if (
      !isNonEmptyString(releaseArtifact.path) ||
      !isPositiveInteger(releaseArtifact.bytes) ||
      !isPositiveInteger(checksum.bytes) ||
      !isSha256(releaseArtifact.sha256) ||
      !isSha256(checksum.sha256)
    ) {
      return "checksum receipt is missing public release artifact checksum";
    }

    if (releaseArtifact.bytes !== checksum.bytes) {
      return "checksum receipt release artifact byte count does not match checksum proof";
    }

    if (releaseArtifact.sha256 !== checksum.sha256) {
      return "checksum receipt release artifact checksum does not match checksum proof";
    }

    const releaseArtifactCurrentStateWeakness = classifyCurrentFileProofWeakness(
      releaseArtifact.path,
      releaseArtifact.bytes,
      releaseArtifact.sha256,
      "checksum release artifact"
    );

    if (releaseArtifactCurrentStateWeakness) {
      return releaseArtifactCurrentStateWeakness;
    }
  }

  if (kind === "signing") {
    if (receipt?.receipt !== "dx.extension.package.signing") {
      return "signing receipt is not a package signing receipt";
    }

    if (
      releaseClaims?.publicReleasePackageVerified !== true ||
      releaseClaims.releaseChecksumVerified !== true ||
      releaseClaims.signingVerified !== true
    ) {
      return "signing receipt is not linked to a public release package";
    }

    const packageOutput = readRecordField(receipt, "packageOutput");
    const signedArtifact = readRecordField(receipt, "signedArtifact");
    const signature = readRecordField(receipt, "signature");

    if (
      !isNonEmptyString(packageOutput?.receiptPath) ||
      !isSha256(packageOutput.receiptSha256) ||
      !isSha256(packageOutput.packageOutputSha256)
    ) {
      return "signing receipt is missing package output checksum linkage";
    }

    if (!isNonEmptyString(packageOutput.checksumReceiptPath) || !isSha256(packageOutput.checksumReceiptSha256)) {
      return "signing receipt is missing release checksum receipt linkage";
    }

    if (!isSha256(signedArtifact?.sha256)) {
      return "signing receipt is missing signed artifact checksum";
    }

    if (signature?.verified !== true) {
      return "signing receipt is missing verified signature proof";
    }

    const packageOutputReceiptWeakness = classifyLinkedReceiptWeakness(
      {
        receiptPath: packageOutput.receiptPath,
        receiptSha256: packageOutput.receiptSha256
      },
      "signing package-output"
    );

    if (packageOutputReceiptWeakness) {
      return packageOutputReceiptWeakness;
    }

    const checksumReceiptWeakness = classifyLinkedReceiptWeakness(
      {
        receiptPath: packageOutput.checksumReceiptPath,
        receiptSha256: packageOutput.checksumReceiptSha256
      },
      "signing checksum"
    );

    if (checksumReceiptWeakness) {
      return checksumReceiptWeakness;
    }

    const signedArtifactWeakness = classifyCurrentSha256FileProofWeakness(
      signedArtifact.path,
      signedArtifact.sha256,
      "signing signed artifact"
    );

    if (signedArtifactWeakness) {
      return signedArtifactWeakness;
    }

    const signatureFileWeakness = classifyCurrentSha256FileProofWeakness(
      signature.path,
      signature.sha256,
      "signing signature"
    );

    if (signatureFileWeakness) {
      return signatureFileWeakness;
    }

    const verificationOutputWeakness = classifyCurrentSha256FileProofWeakness(
      signature.verificationOutputPath,
      signature.verificationOutputSha256,
      "signing signature verification output"
    );

    if (verificationOutputWeakness) {
      return verificationOutputWeakness;
    }

    const linkedChecksumReceiptContentWeakness = classifyWeakness(
      "checksum",
      packageOutput.checksumReceiptPath,
      expectedAdapterId,
      workspaceRoot
    );

    if (linkedChecksumReceiptContentWeakness) {
      return `signing checksum receipt is weak: ${linkedChecksumReceiptContentWeakness}`;
    }
  }

  if (reviewEvidenceKinds.has(kind)) {
    if (receipt?.receipt !== "dx.extension.distribution_review") {
      return "review receipt is not a distribution review receipt";
    }

    const review = readRecordField(receipt, "review");
    const reviewKinds = readStringArrayField(review, "reviewKinds");

    if (!reviewKinds.includes(kind)) {
      return "review receipt does not cover the required review kind";
    }

    if (!isNonEmptyString(review?.reviewKind) || !reviewKinds.includes(review.reviewKind)) {
      return "review receipt primary review kind is invalid";
    }

    if (kind !== "distribution_review" && review.reviewKind !== kind) {
      return "review receipt primary review kind does not cover the required review kind";
    }

    if (review.reviewStatus !== "approved") {
      return "review receipt status must be approved";
    }

    if (
      !isNonEmptyString(review.decidedAt) ||
      !isSha256(review.submissionIdSha256) ||
      !isSha256(review.reviewRecordSha256)
    ) {
      return "review receipt must carry submission and review record hashes";
    }

    if (releaseClaims?.reviewVerified !== true) {
      return "review receipt does not verify review approval";
    }

    const manualProofWeakness = classifyManualProofWeakness(receipt, "distribution review");

    if (manualProofWeakness) {
      return manualProofWeakness;
    }

    if (kind === "oauth_review") {
      return releaseClaims.oauthReviewVerified === true
        ? undefined
        : "OAuth review receipt does not verify OAuth review approval";
    }

    if (expectedAdapterId === browserCommandCenterAdapterId && kind === "distribution_review") {
      const browserStoreTargetWeakness = classifyBrowserStoreDistributionTargetWeakness(review);

      if (browserStoreTargetWeakness) {
        return browserStoreTargetWeakness;
      }
    }

    if (
      releaseClaims.distributionVerified !== true ||
      releaseClaims.publicReleasePackageVerified !== true ||
      releaseClaims.releaseChecksumVerified !== true ||
      releaseClaims.signingVerified !== true
    ) {
      return "distribution review receipt is not linked to signed public release package evidence";
    }

    const linkedReceipts = readRecordField(receipt, "linkedReceipts");

    if (
      !isNonEmptyString(linkedReceipts?.signingReceiptPath) ||
      !isSha256(linkedReceipts.signingReceiptSha256) ||
      !isNonEmptyString(linkedReceipts.checksumReceiptPath) ||
      !isSha256(linkedReceipts.checksumReceiptSha256)
    ) {
      return "distribution review receipt is missing linked signing or checksum receipts";
    }

    const signingReceiptWeakness = classifyLinkedReceiptWeakness(
      {
        receiptPath: linkedReceipts.signingReceiptPath,
        receiptSha256: linkedReceipts.signingReceiptSha256
      },
      "distribution review signing"
    );

    if (signingReceiptWeakness) {
      return signingReceiptWeakness;
    }

    const checksumReceiptWeakness = classifyLinkedReceiptWeakness(
      {
        receiptPath: linkedReceipts.checksumReceiptPath,
        receiptSha256: linkedReceipts.checksumReceiptSha256
      },
      "distribution review checksum"
    );

    if (checksumReceiptWeakness) {
      return checksumReceiptWeakness;
    }

    const linkedSigningReceiptWeakness = classifyWeakness(
      "signing",
      linkedReceipts.signingReceiptPath,
      expectedAdapterId,
      workspaceRoot
    );

    if (linkedSigningReceiptWeakness) {
      return `distribution review signing receipt is weak: ${linkedSigningReceiptWeakness}`;
    }

    const linkedChecksumReceiptWeakness = classifyWeakness(
      "checksum",
      linkedReceipts.checksumReceiptPath,
      expectedAdapterId,
      workspaceRoot
    );

    if (linkedChecksumReceiptWeakness) {
      return `distribution review checksum receipt is weak: ${linkedChecksumReceiptWeakness}`;
    }
  }

  if (kind === "local_service") {
    if (receipt?.receipt === "dx.extension.office_taskpane.local_service") {
      return classifyOfficeLocalServiceWeakness(receipt);
    }

    if (receipt?.receipt !== "dx.extension.local_service") {
      return "local-service receipt is not a local-service receipt";
    }

    if (
      releaseClaims?.loadedHostVerified !== true ||
      releaseClaims.localServiceVerified !== true
    ) {
      return "local-service receipt is not linked to verified host execution";
    }

    const loadedHost = readRecordField(receipt, "loadedHost");

    if (!isNonEmptyString(loadedHost?.receiptPath) || !isSha256(loadedHost.receiptSha256)) {
      return "local-service receipt is missing loaded-host receipt linkage";
    }

    const loadedHostCurrentStateWeakness = classifyLinkedReceiptWeakness(
      loadedHost,
      "local-service loaded-host"
    );

    if (loadedHostCurrentStateWeakness) {
      return loadedHostCurrentStateWeakness;
    }

    const loadedHostSemanticWeakness = classifyWeakness(
      "host_execution",
      loadedHost.receiptPath,
      expectedAdapterId,
      workspaceRoot
    );

    if (loadedHostSemanticWeakness) {
      return `local-service loaded-host receipt is weak: ${loadedHostSemanticWeakness}`;
    }

    const manualProofCurrentStateWeakness = classifyManualProofWeakness(receipt, "local-service");

    if (manualProofCurrentStateWeakness) {
      return manualProofCurrentStateWeakness;
    }

    const localService = readRecordField(receipt, "localService");
    const endpoint = readRecordField(localService, "endpoint");

    if (
      localService?.protocol !== "dx.local-service" ||
      localService.schemaVersion !== 1 ||
      localService.connected !== true
    ) {
      return "local-service receipt does not verify a connected DX local service";
    }

    if (
      !isLoopbackHost(endpoint?.host) ||
      !isValidPort(endpoint?.port) ||
      !["loopback-http", "loopback-websocket"].includes(String(endpoint?.transport))
    ) {
      return "local-service receipt endpoint is not loopback";
    }

    if (localService.storesHostPayloads !== false || localService.mutatesHostDocument !== false) {
      return "local-service receipt does not preserve metadata-only host safety";
    }

    if (!hasMetadataOnlyRequests(localService.requests)) {
      return "local-service receipt is missing metadata-only request proof";
    }

    if (!hasSuccessfulMetadataOnlyResponses(localService.responses)) {
      return "local-service receipt is missing successful response proof";
    }

    const localServiceCommandWeakness = classifyLocalServiceCommandSemanticsWeakness(
      workspaceRoot,
      expectedAdapterId,
      localService
    );

    if (localServiceCommandWeakness) {
      return localServiceCommandWeakness;
    }
  }

  if (kind === "native_host_package") {
    if (receipt?.receipt !== "dx.extension.browser.native_host_package") {
      return "native-host package receipt is not a browser native-host package receipt";
    }

    if (receipt.adapterId !== "dx.browser.command-center" || receipt.host !== "browser") {
      return "native-host package receipt is not linked to the browser adapter";
    }

    if (
      releaseClaims?.packageOutputVerified !== true ||
      releaseClaims.nativeHostReleasePackageVerified !== true
    ) {
      return "native-host package receipt does not verify package output and native-host package evidence";
    }

    const packageOutput = readRecordField(receipt, "packageOutput");

    if (
      !isNonEmptyString(packageOutput?.receiptPath) ||
      !isSha256(packageOutput.receiptSha256) ||
      !isSha256(packageOutput.packageSha256) ||
      !isPositiveInteger(packageOutput.filesVerified)
    ) {
      return "native-host package receipt is missing package-output linkage";
    }

    const nativeHost = readRecordField(receipt, "nativeHost");
    const executable = readRecordField(nativeHost, "executable");

    if (
      !isNonEmptyString(executable?.path) ||
      !isNonEmptyString(executable.fileName) ||
      !["windows", "macos", "linux"].includes(String(executable.targetOs)) ||
      !["x64", "arm64"].includes(String(executable.targetArch)) ||
      !isPositiveInteger(executable.bytes) ||
      !isSha256(executable.sha256)
    ) {
      return "native-host package receipt is missing executable proof";
    }

    const nativeHostPackageWeaknesses: string[] = [];
    let packagedFirefoxExtensionId: string | undefined;
    const packageOutputCurrentStateWeakness = classifyBrowserNativeHostLinkedPackageOutputWeakness(
      packageOutput
    );

    if (packageOutputCurrentStateWeakness) {
      nativeHostPackageWeaknesses.push(packageOutputCurrentStateWeakness);
    } else {
      const firefoxExtensionIdResult = readBrowserNativeHostLinkedFirefoxExtensionId(packageOutput);

      if (firefoxExtensionIdResult.weakness) {
        nativeHostPackageWeaknesses.push(firefoxExtensionIdResult.weakness);
      } else {
        packagedFirefoxExtensionId = firefoxExtensionIdResult.extensionId;
      }
    }

    const executableCurrentStateWeakness = classifyCurrentFileProofWeakness(
      executable.path,
      executable.bytes,
      executable.sha256,
      "native-host package executable"
    );

    if (executableCurrentStateWeakness) {
      nativeHostPackageWeaknesses.push(executableCurrentStateWeakness);
    }

    const extensionIdCapture = readRecordField(receipt, "extensionIdCapture");

    if (
      !isNonEmptyString(extensionIdCapture?.receiptPath) ||
      !isSha256(extensionIdCapture.receiptSha256) ||
      !isChromiumExtensionId(extensionIdCapture.chromeExtensionId) ||
      !isChromiumExtensionId(extensionIdCapture.edgeExtensionId) ||
      !hasSameStringSet(readStringArrayField(extensionIdCapture, "capturedTargets"), ["chrome", "edge"])
    ) {
      nativeHostPackageWeaknesses.push("native-host package receipt is missing extension ID capture linkage");
    } else {
      const extensionIdCaptureCurrentStateWeakness = classifyBrowserNativeHostExtensionIdCaptureWeakness(
        extensionIdCapture,
        nativeHost?.manifests
      );

      if (extensionIdCaptureCurrentStateWeakness) {
        nativeHostPackageWeaknesses.push(extensionIdCaptureCurrentStateWeakness);
      }
    }

    const manifestWeakness = classifyBrowserNativeHostManifestsWeakness(
      nativeHost?.manifests,
      executable.path,
      packagedFirefoxExtensionId
    );

    if (manifestWeakness) {
      nativeHostPackageWeaknesses.push(manifestWeakness);
    }

    if (nativeHostPackageWeaknesses.length > 0) {
      return formatCombinedWeakness(nativeHostPackageWeaknesses);
    }
  }

  if (kind === "ccx_package") {
    if (receipt?.receipt !== "dx.extension.adobe_uxp.ccx_package") {
      return "CCX package receipt is not an Adobe UXP CCX package receipt";
    }

    const ccxConfig = adobeCcxPackageConfigs[String(receipt.adapterId)];

    if (!ccxConfig || receipt.host !== ccxConfig.host) {
      return "CCX package receipt is not linked to an Adobe UXP adapter";
    }

    if (releaseClaims?.packageOutputVerified !== true || releaseClaims.ccxPackaged !== true) {
      return "CCX package receipt does not verify package output and CCX packaging";
    }

    const packageOutput = readRecordField(receipt, "packageOutput");

    if (
      !isNonEmptyString(packageOutput?.receiptPath) ||
      !isSha256(packageOutput.receiptSha256) ||
      !isSha256(packageOutput.packageSha256) ||
      !isPositiveInteger(packageOutput.filesVerified)
    ) {
      return "CCX package receipt is missing package-output linkage";
    }

    const linkedPackageOutputWeakness = classifyLinkedPackageOutputWeakness(receipt, "CCX package");

    if (linkedPackageOutputWeakness) {
      return linkedPackageOutputWeakness;
    }

    const sourcePackage = readRecordField(receipt, "sourcePackage");

    if (
      !isNonEmptyString(sourcePackage?.root) ||
      sourcePackage.manifestId !== ccxConfig.manifestId ||
      !isNonEmptyString(sourcePackage.manifestVersion) ||
      sourcePackage.manifestMain !== "index.html" ||
      sourcePackage.hostApp !== ccxConfig.hostApp
    ) {
      return "CCX package receipt is missing source package manifest proof";
    }

    const ccxPackage = readRecordField(receipt, "ccxPackage");

    if (
      !isNonEmptyString(ccxPackage?.artifactPath) ||
      ccxPackage.fileName !== ccxConfig.artifactFileName ||
      ccxPackage.format !== "ccx" ||
      !isPositiveInteger(ccxPackage.bytes) ||
      !isSha256(ccxPackage.sha256) ||
      !["uxp-developer-tool", "adobe-uxp-packager", "dx-ccx-packager"].includes(String(ccxPackage.packagingTool)) ||
      !isNonEmptyString(ccxPackage.packagingToolVersion)
    ) {
      return "CCX package receipt is missing CCX artifact proof";
    }

    const ccxPackageCurrentStateWeakness = classifyCurrentFileProofWeakness(
      ccxPackage.artifactPath,
      ccxPackage.bytes,
      ccxPackage.sha256,
      "CCX package artifact"
    );

    if (ccxPackageCurrentStateWeakness) {
      return ccxPackageCurrentStateWeakness;
    }
  }

  return undefined;
}

function classifyExpectedAdapterWeakness(
  receipt: Record<string, unknown> | undefined,
  expectedAdapterId: string
): string | undefined {
  if (!receipt) {
    return undefined;
  }

  if (receipt.adapterId !== expectedAdapterId) {
    const actualAdapterId = isNonEmptyString(receipt.adapterId) ? receipt.adapterId : "missing";

    return `receipt adapter id ${actualAdapterId} does not match expected adapter id ${expectedAdapterId}`;
  }

  return undefined;
}

function classifyBrowserStoreDistributionTargetWeakness(
  review: Record<string, unknown> | undefined
): string | undefined {
  const browserStoreTargets = readStringArrayField(review, "browserStoreTargets");

  return hasSameStringSet(browserStoreTargets, requiredBrowserStoreTargets)
    ? undefined
    : "browser store distribution receipt must cover Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO";
}

function classifyBrowserLoadedProfileRequiredTargetWeakness(
  kind: string,
  receipt: Record<string, unknown> | undefined,
  requiredReceiptPath: string | undefined
): string | undefined {
  if (kind !== "host_execution" || receipt?.receipt !== "dx.extension.browser.loaded_profile") {
    return undefined;
  }

  const requiredTarget = requiredBrowserTargetFromLoadedProfilePath(requiredReceiptPath);

  if (!requiredTarget) {
    return undefined;
  }

  if (receipt.target !== requiredTarget) {
    return `browser loaded-profile receipt target ${String(receipt.target)} does not match required ${requiredTarget} receipt path`;
  }

  return undefined;
}

function requiredBrowserTargetFromLoadedProfilePath(receiptPath: string | undefined): string | undefined {
  if (!isNonEmptyString(receiptPath)) {
    return undefined;
  }

  const fileName = receiptPath.split("/").at(-1);
  const match = fileName?.match(/^(chrome|edge|firefox)-loaded-profile-latest\.json$/);

  return match?.[1];
}

function classifyBrowserNativeHostExtensionIdCaptureWeakness(
  extensionIdCapture: Record<string, unknown>,
  manifestsValue: unknown
): string | undefined {
  if (
    !isNonEmptyString(extensionIdCapture.receiptPath) ||
    !isSha256(extensionIdCapture.receiptSha256) ||
    !isChromiumExtensionId(extensionIdCapture.chromeExtensionId) ||
    !isChromiumExtensionId(extensionIdCapture.edgeExtensionId)
  ) {
    return "native-host package receipt is missing extension ID capture linkage";
  }

  if (!existsSync(extensionIdCapture.receiptPath)) {
    return `native-host package extension ID capture receipt does not exist: ${extensionIdCapture.receiptPath}`;
  }

  const receiptBytes = readFileSync(extensionIdCapture.receiptPath);

  if (sha256(receiptBytes) !== extensionIdCapture.receiptSha256) {
    return "native-host package extension ID capture receipt hash changed";
  }

  let receipt: Record<string, unknown>;

  try {
    const parsedReceipt = JSON.parse(receiptBytes.toString("utf8"));

    if (!isRecord(parsedReceipt)) {
      return "native-host package extension ID capture receipt is not a JSON object";
    }

    receipt = parsedReceipt;
  } catch {
    return "native-host package extension ID capture receipt is not readable JSON";
  }

  if (
    receipt.receipt !== "dx.extension.browser.extension_id_capture" ||
    receipt.adapterId !== "dx.browser.command-center" ||
    receipt.host !== "browser"
  ) {
    return "native-host package extension ID capture receipt is invalid";
  }

  const captures = Array.isArray(receipt.captures) ? receipt.captures.filter(isRecord) : [];
  const capturedIds = new Map(
    captures
      .filter((capture) => capture.target === "chrome" || capture.target === "edge")
      .map((capture) => [capture.target, capture.extensionId])
  );

  if (
    capturedIds.get("chrome") !== extensionIdCapture.chromeExtensionId ||
    capturedIds.get("edge") !== extensionIdCapture.edgeExtensionId
  ) {
    return "native-host package extension ID capture values changed";
  }

  const manifests = Array.isArray(manifestsValue) ? manifestsValue.filter(isRecord) : [];
  const manifestByTarget = new Map(manifests.map((manifest) => [manifest.target, manifest]));
  const chromeOrigins = readStringArrayField(manifestByTarget.get("chrome"), "allowedOrigins");
  const edgeOrigins = readStringArrayField(manifestByTarget.get("edge"), "allowedOrigins");

  if (!chromeOrigins.includes(`chrome-extension://${extensionIdCapture.chromeExtensionId}/`)) {
    return "native-host package Chrome manifest no longer matches captured extension ID";
  }

  if (!edgeOrigins.includes(`chrome-extension://${extensionIdCapture.edgeExtensionId}/`)) {
    return "native-host package Edge manifest no longer matches captured extension ID";
  }

  return undefined;
}

function readReceiptObject(absolutePath: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(readFileSync(absolutePath, "utf8"));

    if (isRecord(value)) {
      return value;
    }
  } catch {
    return undefined;
  }

  return undefined;
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

function readStringArrayField(value: Record<string, unknown> | undefined, key: string): string[] {
  if (!value) {
    return [];
  }

  const field = value[key];

  return Array.isArray(field) && field.every((item) => typeof item === "string") ? field : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isChromiumExtensionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-p]{32}$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isLoopbackHost(value: unknown): value is string {
  return value === "127.0.0.1" || value === "localhost" || value === "::1";
}

function isValidPort(value: unknown): value is number {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && value > 0;
}

function hasReleasePackageOutputLink(receipt: Record<string, unknown> | undefined): boolean {
  const packageOutput = readRecordField(receipt, "packageOutput");

  return (
    isNonEmptyString(packageOutput?.receiptPath) &&
    isSha256(packageOutput.receiptSha256) &&
    isSha256(packageOutput.packageSha256) &&
    isPositiveInteger(packageOutput.filesVerified)
  );
}

function hasManualProofLink(receipt: Record<string, unknown> | undefined): boolean {
  const manualProof = readRecordField(receipt, "manualProof");

  return isNonEmptyString(manualProof?.proofFilePath) && isSha256(manualProof.proofFileSha256);
}

function classifyLocalServiceCommandSemanticsWeakness(
  workspaceRoot: string,
  adapterId: string,
  localService: Record<string, unknown>
): string | undefined {
  const actions = readManifestLocalServiceActions(workspaceRoot, adapterId);

  if (typeof actions === "string") {
    return actions;
  }

  const requests = readRecordArray(localService.requests);
  const responses = readRecordArray(localService.responses);
  const expectedOperations = new Map(actions.map((action) => [action.id, action.operation]));
  const requestCommandIds = new Set<string>();

  for (const request of requests) {
    const commandId = String(request.commandId);
    const expectedOperation = expectedOperations.get(commandId);

    if (!expectedOperation) {
      return "local-service receipt uses unsupported command metadata";
    }

    if (request.operation !== expectedOperation) {
      return "local-service receipt has an invalid command operation";
    }

    if (requestCommandIds.has(commandId)) {
      return "local-service receipt duplicates command metadata";
    }

    requestCommandIds.add(commandId);
  }

  for (const action of actions) {
    if (!requestCommandIds.has(action.id)) {
      return "local-service receipt is missing required command metadata";
    }
  }

  const responseCommandIds = new Set<string>();

  for (const response of responses) {
    const commandId = String(response.commandId);

    if (!requestCommandIds.has(commandId) || responseCommandIds.has(commandId)) {
      return "local-service response command set does not match request command set";
    }

    responseCommandIds.add(commandId);
  }

  if (
    responseCommandIds.size !== requestCommandIds.size ||
    ![...requestCommandIds].every((commandId) => responseCommandIds.has(commandId))
  ) {
    return "local-service response command set does not match request command set";
  }

  return undefined;
}

function readManifestLocalServiceActions(
  workspaceRoot: string,
  adapterId: string
): Array<{ id: string; operation: string }> | string {
  const officialRegistryPath = join(workspaceRoot, "registry", "official-extensions.toml");

  if (!existsSync(officialRegistryPath)) {
    return "local-service receipt is missing official extension registry";
  }

  const officialRegistry = parseTomlDocument(readFileSync(officialRegistryPath, "utf8"));
  const officialEntry = (officialRegistry.arrays.extensions ?? []).find((entry) => entry.id === adapterId);

  if (!officialEntry || !isNonEmptyString(officialEntry.manifest)) {
    return "local-service receipt is missing official extension manifest";
  }

  const manifestPath = join(workspaceRoot, ...officialEntry.manifest.split("/"));

  if (!existsSync(manifestPath)) {
    return `local-service receipt manifest does not exist: ${officialEntry.manifest}`;
  }

  const manifest = parseTomlDocument(readFileSync(manifestPath, "utf8"));
  const actions = (manifest.arrays.host_actions ?? [])
    .filter((action) => action.transport === "local-service")
    .map((action) => ({
      id: action.id,
      operation: action.operation
    }))
    .filter(
      (action): action is { id: string; operation: string } =>
        isNonEmptyString(action.id) && isNonEmptyString(action.operation)
    );

  return actions.length > 0
    ? actions
    : "local-service receipt is missing manifest local-service actions";
}

function hasMetadataOnlyRequests(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (request) =>
        isRecord(request) &&
        isNonEmptyString(request.commandId) &&
        isNonEmptyString(request.operation) &&
        request.metadataOnly === true &&
        request.transport === "local-service"
    )
  );
}

function hasSuccessfulMetadataOnlyResponses(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (response) =>
        isRecord(response) &&
        isNonEmptyString(response.commandId) &&
        response.status === "ok" &&
        response.payloadKind === "metadata-only"
    )
  );
}

function readRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function classifyBrowserNativeHostLinkedPackageOutputWeakness(
  packageOutput: Record<string, unknown> | undefined
): string | undefined {
  if (!isNonEmptyString(packageOutput?.receiptPath)) {
    return "native-host package receipt is missing package-output linkage";
  }

  if (!existsSync(packageOutput.receiptPath)) {
    return `native-host package linked package-output receipt does not exist: ${packageOutput.receiptPath}`;
  }

  const receiptBytes = readFileSync(packageOutput.receiptPath);
  const actualReceiptSha256 = sha256(receiptBytes);

  if (actualReceiptSha256 !== packageOutput.receiptSha256) {
    return "native-host package linked package-output receipt hash changed";
  }

  let receipt: Record<string, unknown>;

  try {
    const parsedReceipt = JSON.parse(receiptBytes.toString("utf8"));

    if (!isRecord(parsedReceipt)) {
      return "native-host package linked package-output receipt is not a JSON object";
    }

    receipt = parsedReceipt;
  } catch {
    return "native-host package linked package-output receipt is not readable JSON";
  }

  let proof;

  try {
    proof = verifyPackageOutputReceipt("dx.browser.command-center", receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return `native-host package linked package-output receipt is invalid: ${message}`;
  }

  if (proof.sha256 !== packageOutput.packageSha256) {
    return "native-host package linked package-output aggregate hash changed";
  }

  if (proof.filesVerified !== packageOutput.filesVerified) {
    return "native-host package linked package-output file count changed";
  }

  return undefined;
}

function readBrowserNativeHostLinkedFirefoxExtensionId(
  packageOutput: Record<string, unknown> | undefined
): { extensionId?: string; weakness?: string } {
  if (!isNonEmptyString(packageOutput?.receiptPath)) {
    return { weakness: "native-host package receipt is missing package-output linkage" };
  }

  let receipt: Record<string, unknown>;

  try {
    const parsedReceipt = JSON.parse(readFileSync(packageOutput.receiptPath, "utf8"));

    if (!isRecord(parsedReceipt)) {
      return { weakness: "native-host package linked package-output receipt is not a JSON object" };
    }

    receipt = parsedReceipt;
  } catch {
    return { weakness: "native-host package linked package-output receipt is not readable JSON" };
  }

  const targets = Array.isArray(receipt.targets) ? receipt.targets.filter(isRecord) : [];
  const firefoxTarget = targets.find((target) => target.name === "firefox");
  const extensionId = firefoxTarget?.extensionId;

  if (!isNonEmptyString(extensionId)) {
    return {
      weakness: "native-host package linked package-output receipt is missing packaged Firefox extension id"
    };
  }

  return { extensionId };
}

function classifyChecksumLinkedPackageOutputWeakness(
  packageOutput: Record<string, unknown> | undefined
): string | undefined {
  if (
    !isNonEmptyString(packageOutput?.receiptPath) ||
    !isSha256(packageOutput.receiptSha256) ||
    !isPositiveInteger(packageOutput.fileCount) ||
    !isPositiveInteger(packageOutput.filesVerified)
  ) {
    return "checksum receipt is missing package-output receipt linkage";
  }

  if (!existsSync(packageOutput.receiptPath)) {
    return `checksum linked package-output receipt does not exist: ${packageOutput.receiptPath}`;
  }

  const receiptBytes = readFileSync(packageOutput.receiptPath);

  if (sha256(receiptBytes) !== packageOutput.receiptSha256) {
    return "checksum linked package-output receipt hash changed";
  }

  let receipt: Record<string, unknown>;

  try {
    const parsedReceipt = JSON.parse(receiptBytes.toString("utf8"));

    if (!isRecord(parsedReceipt)) {
      return "checksum linked package-output receipt is not a JSON object";
    }

    receipt = parsedReceipt;
  } catch {
    return "checksum linked package-output receipt is not readable JSON";
  }

  const packageOutputWeakness = classifyCoreEvidenceWeakness("package_output", receipt);

  if (packageOutputWeakness) {
    return `checksum linked package-output receipt is weak: ${packageOutputWeakness}`;
  }

  let proof;

  try {
    proof = verifyPackageOutputReceipt(String(receipt.adapterId), receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return `checksum linked package-output receipt is invalid: ${message}`;
  }

  if (proof.sha256 !== packageOutput.packageOutputSha256) {
    return "checksum linked package-output aggregate hash changed";
  }

  if (proof.filesVerified !== packageOutput.filesVerified || proof.filesVerified !== packageOutput.fileCount) {
    return "checksum linked package-output file count changed";
  }

  return undefined;
}

function classifyCurrentFileProofWeakness(
  filePath: string,
  expectedBytes: number,
  expectedSha256: string,
  label: string
): string | undefined {
  if (!existsSync(filePath)) {
    return `${label} file does not exist: ${filePath}`;
  }

  const bytes = readFileSync(filePath);

  if (bytes.length !== expectedBytes) {
    return `${label} file size changed`;
  }

  if (sha256(bytes) !== expectedSha256) {
    return `${label} file hash changed`;
  }

  return undefined;
}

function formatCombinedWeakness(weaknesses: string[]): string {
  return uniqueSorted(weaknesses).join("; ");
}

function classifyBrowserNativeHostManifestsWeakness(
  value: unknown,
  nativeHostPath: string,
  packagedFirefoxExtensionId?: string
): string | undefined {
  if (!Array.isArray(value)) {
    return "native-host package receipt is missing Chrome, Edge, or Firefox manifest proof";
  }

  const manifests = value.filter(isRecord);
  const manifestsByTarget = new Map(manifests.map((manifest) => [manifest.target, manifest]));

  for (const target of ["chrome", "edge", "firefox"]) {
    const manifest = manifestsByTarget.get(target);

    if (
      !manifest ||
      !isNonEmptyString(manifest.manifestPath) ||
      !isSha256(manifest.sha256) ||
      !isNonEmptyString(manifest.name) ||
      manifest.type !== "stdio" ||
      manifest.nativeHostPath !== nativeHostPath
    ) {
      return "native-host package receipt is missing Chrome, Edge, or Firefox manifest proof";
    }

    if (!existsSync(manifest.manifestPath)) {
      return `native-host package ${target} manifest file does not exist: ${manifest.manifestPath}`;
    }

    const manifestBytes = readFileSync(manifest.manifestPath);

    if (sha256(manifestBytes) !== manifest.sha256) {
      return `native-host package ${target} manifest file hash changed`;
    }

    let manifestJson: Record<string, unknown>;

    try {
      const parsedManifest = JSON.parse(manifestBytes.toString("utf8"));

      if (!isRecord(parsedManifest)) {
        return `native-host package ${target} manifest file is not a JSON object`;
      }

      manifestJson = parsedManifest;
    } catch {
      return `native-host package ${target} manifest file is not readable JSON`;
    }

    if (manifestJson.name !== manifest.name || manifestJson.type !== "stdio" || manifestJson.path !== nativeHostPath) {
      return `native-host package ${target} manifest JSON no longer matches the receipt`;
    }

    if (target === "firefox") {
      const allowedExtensions = readStringArrayField(manifest, "allowedExtensions");
      const manifestAllowedExtensions = readStringArrayField(manifestJson, "allowed_extensions");

      if (
        packagedFirefoxExtensionId &&
        (manifest.extensionId !== packagedFirefoxExtensionId ||
          !hasSameStringSet(allowedExtensions, [packagedFirefoxExtensionId]) ||
          !hasSameStringSet(manifestAllowedExtensions, [packagedFirefoxExtensionId]))
      ) {
        return "native-host package Firefox manifest no longer matches packaged Firefox extension id";
      }

      if (
        allowedExtensions.length === 0 ||
        !allowedExtensions.every((extensionId) => /^[A-Za-z0-9._@-]+$/.test(extensionId)) ||
        !hasSameStringSet(allowedExtensions, manifestAllowedExtensions)
      ) {
        return "native-host package Firefox manifest allowed extensions changed";
      }

      continue;
    }

    const allowedOrigins = readStringArrayField(manifest, "allowedOrigins");
    const manifestAllowedOrigins = readStringArrayField(manifestJson, "allowed_origins");

    if (
      allowedOrigins.length === 0 ||
      !allowedOrigins.every((origin) => /^chrome-extension:\/\/[a-p]{32}\/$/.test(origin)) ||
      !hasSameStringSet(allowedOrigins, manifestAllowedOrigins)
    ) {
      return `native-host package ${target} manifest allowed origins changed`;
    }
  }

  return undefined;
}

function hasSameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sum(extensions: ReleaseEvidenceGapEntry[], key: keyof ReleaseEvidenceGapEntry): number {
  return extensions.reduce((total, extension) => total + Number(extension[key]), 0);
}

function countEnvironmentBlockers(extensions: ReleaseEvidenceGapEntry[]): number {
  return extensions.reduce((total, extension) => total + extension.environment.blockers.length, 0);
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
