import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateProfessionalHostTargetCatalog } from "../validate-host-target-catalog.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-host-targets-"));

try {
  mkdirSync(join(workspaceRoot, "registry"), { recursive: true });
  mkdirSync(join(workspaceRoot, "docs"), { recursive: true });

  writeCatalog(workspaceRoot, validTargets());
  writeGuide(workspaceRoot, validGuide());
  assert.deepEqual(
    validateProfessionalHostTargetCatalog(workspaceRoot),
    [],
    "complete professional host target catalog should pass"
  );

  writeCatalog(workspaceRoot, validTargets().slice(0, 19));
  assertMessages(
    validateProfessionalHostTargetCatalog(workspaceRoot),
    ["professional host target catalog must contain at least 20 targets"]
  );

  writeCatalog(
    workspaceRoot,
    validTargets().filter((target) => target.id !== "browser.edge-extensions")
  );
  assertMessages(
    validateProfessionalHostTargetCatalog(workspaceRoot),
    ["professional host target catalog must include browser.edge-extensions"]
  );

  writeCatalog(
    workspaceRoot,
    validTargets().filter((target) => target.id !== "visual-studio.sdk")
  );
  assertMessages(
    validateProfessionalHostTargetCatalog(workspaceRoot),
    ["professional host target catalog must include visual-studio.sdk"]
  );

  writeCatalog(workspaceRoot, [
    { ...createTarget("figma.plugins"), official_docs: "http://example.test" },
    ...validTargets().slice(1)
  ]);
  assertMessages(
    validateProfessionalHostTargetCatalog(workspaceRoot),
    ["figma.plugins official_docs must use https"]
  );

  writeCatalog(workspaceRoot, [
    { ...createTarget("figma.plugins"), difficulty_percent: 101 },
    ...validTargets().slice(1)
  ]);
  assertMessages(
    validateProfessionalHostTargetCatalog(workspaceRoot),
    ["figma.plugins difficulty_percent must be between 1 and 100"]
  );

  writeGuide(workspaceRoot, validGuide().replace("not release readiness", ""));
  writeCatalog(workspaceRoot, validTargets());
  assertMessages(
    validateProfessionalHostTargetCatalog(workspaceRoot),
    ["professional host target guide must state that the catalog is not release readiness"]
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("professional host target catalog verified");

function assertMessages(actualMessages, expectedMessages) {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeCatalog(root, targets) {
  const body = [
    'schema = "dx.professional_host_targets"',
    "manifest_version = 1",
    "",
    ...targets.map(formatTarget)
  ].join("\n");

  writeFileSync(join(root, "registry", "professional-host-targets.toml"), `${body}\n`);
}

function writeGuide(root, source) {
  writeFileSync(join(root, "docs", "professional-host-targets.md"), source);
}

function formatTarget(target) {
  return [
    "[[targets]]",
    `id = "${target.id}"`,
    `name = "${target.name}"`,
    `vendor = "${target.vendor}"`,
    `host_family = "${target.host_family}"`,
    `official_docs = "${target.official_docs}"`,
    `extension_surface = "${target.extension_surface}"`,
    `adapter_strategy = "${target.adapter_strategy}"`,
    `first_proof = "${target.first_proof}"`,
    `recommended_priority = "${target.recommended_priority}"`,
    `difficulty_percent = ${target.difficulty_percent}`,
    `dx_surfaces = ${formatStringArray(target.dx_surfaces)}`,
    `release_gates = ${formatStringArray(target.release_gates)}`,
    ""
  ].join("\n");
}

function formatStringArray(values) {
  return `[${values.map((value) => `"${value}"`).join(", ")}]`;
}

function validTargets() {
  return [
    "figma.plugins",
    "microsoft.office.add-ins",
    "adobe.photoshop.uxp",
    "adobe.premiere-pro.uxp",
    "adobe.indesign.uxp",
    "blackmagic.davinci-resolve.scripting",
    "blackmagic.fusion.scripting",
    "blender.python-addons",
    "affinity.content-addons",
    "google.workspace-addons",
    "jetbrains.intellij-platform",
    "visual-studio.sdk",
    "autodesk.revit-api",
    "autodesk.autocad-api",
    "unreal-engine.plugins",
    "unity.editor-extensions",
    "rhino.rhinocommon",
    "sketch.plugins",
    "canva.apps-sdk",
    "obsidian.plugins",
    "browser.chrome-extensions",
    "browser.edge-extensions",
    "browser.firefox-webextensions",
    "adobe.acrobat.sdk"
  ].map(createTarget);
}

function createTarget(id) {
  return {
    id,
    name: id,
    vendor: "Example Vendor",
    host_family: "professional-host",
    official_docs: `https://docs.example.test/${id}`,
    extension_surface: "host plugin API",
    adapter_strategy: "thin host adapter to DX CLI or local service",
    first_proof: "metadata-only loaded-host smoke receipt",
    recommended_priority: "research",
    difficulty_percent: 50,
    dx_surfaces: ["icons", "fonts", "media", "forge"],
    release_gates: [
      "official docs evidence",
      "permission review",
      "j1 verification",
      "package signing",
      "loaded-host smoke"
    ]
  };
}

function validGuide() {
  return [
    "# Professional Host Targets",
    "",
    "This catalog ranks possible official DX host adapters. It is planning evidence, not release readiness.",
    "",
    "It is not the official extension registry, and every target must pass the Official Extension Starter gate before source folders are added under hosts/."
  ].join("\n");
}
