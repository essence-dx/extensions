import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTomlDocument } from "./lib/toml-lite.ts";

const catalogRelativePath = "registry/professional-host-targets.toml";
const guideRelativePath = "docs/professional-host-targets.md";
const allowedPriorities = new Set([
  "active-scaffold",
  "fast-proof",
  "starter-candidate",
  "research",
  "deferred",
  "hard-native-sdk"
]);
const allowedSurfaces = new Set([
  "assets",
  "cli",
  "commands",
  "fonts",
  "forge",
  "icons",
  "local-service",
  "media",
  "receipts"
]);
const requiredStringFields = [
  "id",
  "name",
  "vendor",
  "host_family",
  "official_docs",
  "extension_surface",
  "adapter_strategy",
  "first_proof",
  "recommended_priority"
];
const requiredReleaseGatePhrases = [
  "official docs",
  "permission",
  "j1",
  "signing",
  "loaded-host"
];
const requiredTargetIds = [
  "browser.chrome-extensions",
  "browser.edge-extensions",
  "browser.firefox-webextensions",
  "affinity.content-addons",
  "google.workspace-addons",
  "jetbrains.intellij-platform",
  "unity.editor-extensions",
  "unreal-engine.plugins",
  "visual-studio.sdk"
];
const requiredGuidePhrases = [
  ["not release readiness", "professional host target guide must state that the catalog is not release readiness"],
  ["not the official extension registry", "professional host target guide must separate the catalog from the official registry"],
  ["official extension starter gate", "professional host target guide must mention the Official Extension Starter gate"]
];

export function validateProfessionalHostTargetCatalog(root) {
  const failures = [];
  const catalogPath = join(root, catalogRelativePath);
  const guidePath = join(root, guideRelativePath);

  if (!existsSync(catalogPath)) {
    failures.push(`missing professional host target catalog: ${catalogRelativePath}`);
    return failures;
  }

  const catalog = parseTomlDocument(readFileSync(catalogPath, "utf8"));

  if (catalog.root.schema !== "dx.professional_host_targets") {
    failures.push("professional host target catalog schema must be dx.professional_host_targets");
  }

  if (catalog.root.manifest_version !== 1) {
    failures.push("professional host target catalog manifest_version must be 1");
  }

  const targets = catalog.arrays.targets ?? [];
  if (targets.length < 20) {
    failures.push("professional host target catalog must contain at least 20 targets");
  }

  validateTargets(targets, failures);
  validateGuide(guidePath, failures);

  return failures;
}

function validateTargets(targets, failures) {
  const seenIds = new Set();

  for (const target of targets) {
    const id = expectTargetId(target, failures);

    if (!id) {
      continue;
    }

    if (seenIds.has(id)) {
      failures.push(`duplicate professional host target id: ${id}`);
    }
    seenIds.add(id);

    for (const field of requiredStringFields) {
      expectNonEmptyString(target[field], `${id} ${field}`, failures);
    }

    validateOfficialDocs(target, id, failures);
    validatePriority(target, id, failures);
    validateDifficulty(target, id, failures);
    validateSurfaces(target, id, failures);
    validateReleaseGates(target, id, failures);
  }

  for (const requiredTargetId of requiredTargetIds) {
    if (!seenIds.has(requiredTargetId)) {
      failures.push(`professional host target catalog must include ${requiredTargetId}`);
    }
  }
}

function expectTargetId(target, failures) {
  const id = expectNonEmptyString(target.id, "professional host target id", failures);
  if (!id) {
    return undefined;
  }

  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(id)) {
    failures.push(`${id} id must be lower-case dotted or dashed words`);
  }

  return id;
}

function validateOfficialDocs(target, id, failures) {
  if (typeof target.official_docs !== "string") {
    return;
  }

  let officialDocsUrl;
  try {
    officialDocsUrl = new URL(target.official_docs);
  } catch {
    failures.push(`${id} official_docs must be a valid URL`);
    return;
  }

  if (officialDocsUrl.protocol !== "https:") {
    failures.push(`${id} official_docs must use https`);
  }
}

function validatePriority(target, id, failures) {
  if (typeof target.recommended_priority !== "string") {
    return;
  }

  if (!allowedPriorities.has(target.recommended_priority)) {
    failures.push(`${id} recommended_priority is unsupported: ${target.recommended_priority}`);
  }
}

function validateDifficulty(target, id, failures) {
  if (!Number.isInteger(target.difficulty_percent)) {
    failures.push(`${id} difficulty_percent must be an integer`);
    return;
  }

  if (target.difficulty_percent < 1 || target.difficulty_percent > 100) {
    failures.push(`${id} difficulty_percent must be between 1 and 100`);
  }
}

function validateSurfaces(target, id, failures) {
  if (!Array.isArray(target.dx_surfaces) || target.dx_surfaces.length === 0) {
    failures.push(`${id} dx_surfaces must list at least one DX surface`);
    return;
  }

  for (const surface of target.dx_surfaces) {
    if (!allowedSurfaces.has(surface)) {
      failures.push(`${id} dx_surfaces contains unsupported surface: ${surface}`);
    }
  }
}

function validateReleaseGates(target, id, failures) {
  if (!Array.isArray(target.release_gates) || target.release_gates.length === 0) {
    failures.push(`${id} release_gates must list required release gates`);
    return;
  }

  const normalizedGates = target.release_gates.join(" ").toLowerCase();
  for (const phrase of requiredReleaseGatePhrases) {
    if (!normalizedGates.includes(phrase)) {
      failures.push(`${id} release_gates must include ${phrase}`);
    }
  }
}

function validateGuide(guidePath, failures) {
  if (!existsSync(guidePath)) {
    failures.push(`missing professional host target guide: ${guideRelativePath}`);
    return;
  }

  const guide = readFileSync(guidePath, "utf8").toLowerCase();
  for (const [phrase, message] of requiredGuidePhrases) {
    if (!guide.includes(phrase)) {
      failures.push(message);
    }
  }
}

function expectNonEmptyString(value, label, failures) {
  if (typeof value !== "string" || !value.trim()) {
    failures.push(`${label} must be a non-empty string`);
    return undefined;
  }

  return value.trim();
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  const failures = validateProfessionalHostTargetCatalog(process.cwd());

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("professional host target catalog verified");
}
