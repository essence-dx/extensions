import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, normalize } from "node:path";

import { parseTomlDocument } from "./lib/toml-lite.ts";

const registryRelativePath = "registry/official-extensions.toml";
const readinessRelativePath = "registry/extension-readiness.toml";
const allowedStages = new Set([
  "source-level",
  "loaded-host",
  "package-proof",
  "release-ready"
]);
const guardedScriptPrefixes = ["test:", "check:", "smoke:"];
const releaseReceiptKeys = [
  "loaded_host_receipt",
  "package_receipt",
  "signing_receipt",
  "checksum_receipt",
  "distribution_receipt"
];

export function validateExtensionReadiness(root) {
  const failures = [];
  const registryEntries = readOfficialRegistry(root, failures);
  const readinessPath = join(root, readinessRelativePath);

  if (!existsSync(readinessPath)) {
    return [...failures, `missing extension readiness catalog: ${readinessRelativePath}`];
  }

  const readiness = parseTomlDocument(readFileSync(readinessPath, "utf8"));

  if (readiness.root.schema !== "dx.extension_readiness") {
    failures.push("extension readiness schema must be dx.extension_readiness");
  }

  if (readiness.root.manifest_version !== 1) {
    failures.push("extension readiness manifest_version must be 1");
  }

  const officialById = new Map(registryEntries.map((entry) => [entry.id, entry]));
  const readinessEntries = readiness.arrays.extensions ?? [];
  const readinessById = new Map();

  for (const entry of readinessEntries) {
    const id = expectNonEmptyString(entry.id, "readiness extension id", failures);
    if (!id) {
      continue;
    }

    if (readinessById.has(id)) {
      failures.push(`duplicate readiness extension id: ${id}`);
    }
    readinessById.set(id, entry);

    const officialEntry = officialById.get(id);
    if (!officialEntry) {
      failures.push(`readiness entry is not in official registry: ${id}`);
      continue;
    }

    validateReadinessEntry(entry, officialEntry, failures);
  }

  for (const officialEntry of registryEntries) {
    if (!readinessById.has(officialEntry.id)) {
      failures.push(`missing readiness entry for official extension: ${officialEntry.id}`);
    }
  }

  return failures;
}

function readOfficialRegistry(root, failures) {
  const registryPath = join(root, registryRelativePath);
  if (!existsSync(registryPath)) {
    failures.push(`missing official registry: ${registryRelativePath}`);
    return [];
  }

  const registry = parseTomlDocument(readFileSync(registryPath, "utf8"));
  return (registry.arrays.extensions ?? [])
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id.trim() : "",
      manifest: typeof entry.manifest === "string" ? entry.manifest.trim() : ""
    }))
    .filter((entry) => entry.id);
}

function validateReadinessEntry(entry, officialEntry, failures) {
  const id = officialEntry.id;
  const stage = expectNonEmptyString(entry.stage, `readiness stage for ${id}`, failures);
  const manifest = expectNonEmptyString(
    entry.manifest,
    `readiness manifest for ${id}`,
    failures
  );
  const sourceGuard = expectNonEmptyString(
    entry.source_guard,
    `readiness source_guard for ${id}`,
    failures
  );
  const latestReadinessReceipt = expectNonEmptyString(
    entry.latest_readiness_receipt,
    `readiness latest receipt for ${id}`,
    failures
  );
  expectNonEmptyString(entry.next_proof, `readiness next_proof for ${id}`, failures);
  const blockedBy = expectStringArray(
    entry.blocked_by,
    `readiness blocked_by for ${id}`,
    failures
  );

  if (stage && !allowedStages.has(stage)) {
    failures.push(`readiness stage for ${id} is unsupported: ${stage}`);
  }

  if (manifest && manifest !== officialEntry.manifest) {
    failures.push(`readiness manifest for ${id} must match official registry manifest`);
  }

  if (manifest && !isSafeRepositoryPath(manifest)) {
    failures.push(`readiness manifest for ${id} must be a safe relative path`);
  }

  if (sourceGuard && !guardedScriptPrefixes.some((prefix) => sourceGuard.startsWith(prefix))) {
    failures.push(`readiness source_guard for ${id} must reference a test, check, or smoke script`);
  }

  const expectedLatestReceipt = `.dx/receipts/extensions/${id}/readiness-latest.json`;
  if (latestReadinessReceipt && latestReadinessReceipt !== expectedLatestReceipt) {
    failures.push(`readiness latest receipt for ${id} must be ${expectedLatestReceipt}`);
  }

  if (latestReadinessReceipt && !isSafeRepositoryPath(latestReadinessReceipt)) {
    failures.push(`readiness latest receipt for ${id} must be a safe relative path`);
  }

  if (stage !== "release-ready" && blockedBy.length === 0) {
    failures.push(`readiness blocked_by for ${id} must include at least one deferred proof`);
  }

  if (stage === "source-level") {
    validateSourceLevelReceipts(id, entry, failures);
  }

  validateStageReceipts(id, stage, entry, failures);
}

function validateSourceLevelReceipts(id, entry, failures) {
  for (const receiptKey of releaseReceiptKeys) {
    if (isNonEmptyString(entry[receiptKey])) {
      failures.push(`source-level readiness for ${id} must not claim release proof receipts`);
      return;
    }
  }
}

function validateStageReceipts(id, stage, entry, failures) {
  const requiredReceiptsByStage = {
    "loaded-host": ["loaded_host_receipt"],
    "package-proof": ["loaded_host_receipt", "package_receipt", "checksum_receipt"],
    "release-ready": releaseReceiptKeys
  };
  const requiredReceipts = requiredReceiptsByStage[stage] ?? [];

  for (const receiptKey of requiredReceipts) {
    if (!isNonEmptyString(entry[receiptKey])) {
      failures.push(`${stage} readiness for ${id} requires ${receiptKey}`);
      continue;
    }

    if (!isSafeRepositoryPath(entry[receiptKey])) {
      failures.push(`${stage} readiness receipt ${receiptKey} for ${id} must be a safe relative path`);
    }
  }
}

function expectNonEmptyString(value, label, failures) {
  if (!isNonEmptyString(value)) {
    failures.push(`${label} must be a non-empty string`);
    return undefined;
  }

  return value.trim();
}

function expectStringArray(value, label, failures) {
  if (!Array.isArray(value)) {
    failures.push(`${label} must be an array`);
    return [];
  }

  const values = [];
  for (const item of value) {
    if (!isNonEmptyString(item)) {
      failures.push(`${label} must contain only non-empty strings`);
      continue;
    }

    values.push(item.trim());
  }

  return values;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeRepositoryPath(value) {
  if (
    value.includes("\\") ||
    value.includes("://") ||
    value.startsWith("~") ||
    value.startsWith("/") ||
    /^[A-Za-z]:\//.test(value)
  ) {
    return false;
  }

  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  const root = process.cwd();
  const failures = validateExtensionReadiness(root);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("extension readiness verified");
}
