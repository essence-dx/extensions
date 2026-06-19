import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, normalize, sep } from "node:path";

import { parseTomlDocument } from "./lib/toml-lite.ts";

const registryRelativePath = "registry/official-extensions.toml";
const professionalTargetCatalogRelativePath = "registry/professional-host-targets.toml";
const allowedRegistryStatuses = new Set([
  "active",
  "experimental"
]);

export function validateOfficialExtensionRegistry(root) {
  const failures = [];
  const registryPath = join(root, registryRelativePath);

  if (!existsSync(registryPath)) {
    return [`missing official registry: ${registryRelativePath}`];
  }

  const registry = parseTomlDocument(readFileSync(registryPath, "utf8"));
  const professionalTargetIds = readProfessionalTargetIds(root, failures);

  if (registry.root.schema !== "dx.extensions.registry") {
    failures.push("official registry schema must be dx.extensions.registry");
  }

  if (registry.root.manifest_version !== 1) {
    failures.push("official registry manifest_version must be 1");
  }

  const entries = registry.arrays.extensions ?? [];
  if (entries.length === 0) {
    failures.push("official registry must include at least one extension");
  }

  const seenIds = new Set();
  const seenPaths = new Set();
  const seenManifests = new Set();

  for (const entry of entries) {
    const id = expectNonEmptyString(entry.id, "registry extension id", failures);
    const name = expectNonEmptyString(entry.name, `registry name for ${id}`, failures);
    const extensionPath = expectNonEmptyString(
      entry.path,
      `registry path for ${id}`,
      failures
    );
    const manifestPath = expectNonEmptyString(
      entry.manifest,
      `registry manifest for ${id}`,
      failures
    );
    const status = expectNonEmptyString(entry.status, `registry status for ${id}`, failures);
    const professionalTargets = expectNonEmptyStringArray(
      entry.professional_targets,
      `registry professional_targets for ${id}`,
      failures
    );

    if (!id || !name || !extensionPath || !manifestPath || !status) {
      continue;
    }

    for (const professionalTarget of professionalTargets) {
      if (!professionalTargetIds.has(professionalTarget)) {
        failures.push(
          `registry professional target for ${id} is not in professional host target catalog: ${professionalTarget}`
        );
      }
    }

    trackUnique(seenIds, id, `duplicate registry extension id: ${id}`, failures);
    trackUnique(seenPaths, extensionPath, `duplicate registry extension path: ${extensionPath}`, failures);
    trackUnique(
      seenManifests,
      manifestPath,
      `duplicate registry extension manifest: ${manifestPath}`,
      failures
    );

    if (!allowedRegistryStatuses.has(status)) {
      failures.push(`registry status for ${id} is unsupported: ${status}`);
    }

    if (!isSafeRepositoryPath(extensionPath)) {
      failures.push(`registry path for ${id} must be a safe relative path`);
      continue;
    }

    if (!isSafeRepositoryPath(manifestPath)) {
      failures.push(`registry manifest for ${id} must be a safe relative path`);
      continue;
    }

    if (!isPathWithin(manifestPath, extensionPath)) {
      failures.push(`registry manifest for ${id} must be under its path`);
      continue;
    }

    const absoluteExtensionPath = joinRepositoryPath(root, extensionPath);
    const absoluteManifestPath = joinRepositoryPath(root, manifestPath);

    if (!existsSync(absoluteExtensionPath)) {
      failures.push(`registry path for ${id} does not exist: ${extensionPath}`);
      continue;
    }

    if (!existsSync(absoluteManifestPath)) {
      failures.push(`registry manifest for ${id} does not exist: ${manifestPath}`);
      continue;
    }

    validateManifestIdentity({
      root,
      id,
      name,
      manifestPath,
      failures
    });
  }

  validateOfficialManifestCoverage(root, entries, failures);

  return failures;
}

function readProfessionalTargetIds(root, failures) {
  const catalogPath = join(root, professionalTargetCatalogRelativePath);
  if (!existsSync(catalogPath)) {
    failures.push(`missing professional host target catalog: ${professionalTargetCatalogRelativePath}`);
    return new Set();
  }

  const catalog = parseTomlDocument(readFileSync(catalogPath, "utf8"));
  const targetIds = new Set();

  for (const target of catalog.arrays.targets ?? []) {
    if (typeof target.id === "string" && target.id.trim()) {
      targetIds.add(target.id.trim());
    }
  }

  return targetIds;
}

function validateOfficialManifestCoverage(root, entries, failures) {
  const registeredManifests = new Set(
    entries
      .map((entry) => entry.manifest)
      .filter((manifestPath) => typeof manifestPath === "string")
  );

  for (const manifestPath of findHostExtensionManifests(root)) {
    const manifest = parseTomlDocument(
      readFileSync(joinRepositoryPath(root, manifestPath), "utf8")
    );

    if (manifest.sections.extension?.official !== true) {
      continue;
    }

    if (!registeredManifests.has(manifestPath)) {
      failures.push(`official manifest is missing from registry: ${manifestPath}`);
    }
  }
}

function validateManifestIdentity({ root, id, name, manifestPath, failures }) {
  const manifest = parseTomlDocument(
    readFileSync(joinRepositoryPath(root, manifestPath), "utf8")
  );
  const extension = manifest.sections.extension ?? {};

  if (manifest.root.schema !== "dx.extension.manifest") {
    failures.push(`manifest for ${id} schema must be dx.extension.manifest`);
  }

  if (manifest.root.manifest_version !== 1) {
    failures.push(`manifest for ${id} manifest_version must be 1`);
  }

  if (extension.id !== id) {
    failures.push(`registry id ${id} must match manifest extension.id`);
  }

  if (extension.name !== name) {
    failures.push(`registry name for ${id} must match manifest extension.name`);
  }

  if (extension.official !== true) {
    failures.push(`manifest for ${id} must declare official = true`);
  }
}

function expectNonEmptyString(value, label, failures) {
  if (typeof value !== "string" || !value.trim()) {
    failures.push(`${label} must be a non-empty string`);
    return undefined;
  }

  return value.trim();
}

function expectNonEmptyStringArray(value, label, failures) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push(`${label} must include at least one target`);
    return [];
  }

  const values = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      failures.push(`${label} must contain only non-empty strings`);
      continue;
    }

    values.push(item.trim());
  }

  return values;
}

function trackUnique(seenValues, value, message, failures) {
  if (seenValues.has(value)) {
    failures.push(message);
    return;
  }

  seenValues.add(value);
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

function isPathWithin(childPath, parentPath) {
  const normalizedChild = childPath.split("/").join("/");
  const normalizedParent = parentPath.split("/").join("/");
  return normalizedChild.startsWith(`${normalizedParent}/`);
}

function joinRepositoryPath(root, relativePath) {
  return join(root, ...relativePath.split("/")).split(sep).join(sep);
}

function findHostExtensionManifests(root) {
  const hostsRoot = join(root, "hosts");

  if (!existsSync(hostsRoot)) {
    return [];
  }

  return findFiles(hostsRoot, "hosts").filter((relativePath) =>
    relativePath.endsWith("/dx.extension.toml")
  );
}

function findFiles(directory, prefix) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target" || entry.name === "dist") {
      continue;
    }

    const relativePath = `${prefix}/${entry.name}`;
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  const root = process.cwd();
  const failures = validateOfficialExtensionRegistry(root);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("official registry verified");
}
