import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateExtensionReadiness } from "../validate-extension-readiness.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-extension-readiness-"));

try {
  writeValidWorkspace(workspaceRoot);

  assert.deepEqual(
    validateExtensionReadiness(workspaceRoot),
    [],
    "valid source-level readiness entries should pass"
  );

  writeReadiness(workspaceRoot, [
    createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    ["missing readiness entry for official extension: dx.browser.command-center"]
  );

  writeReadiness(workspaceRoot, [
    createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
    createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    ["duplicate readiness extension id: dx.vscode.command-center"]
  );

  writeReadiness(workspaceRoot, [
    createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser"),
    createReadinessEntry("dx.unknown.command-center", "hosts/unknown/dx-unknown")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    ["readiness entry is not in official registry: dx.unknown.command-center"]
  );

  writeReadiness(workspaceRoot, [
    {
      ...createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      manifest: "hosts/browser/dx-browser/dx.extension.toml"
    },
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    ["readiness manifest for dx.vscode.command-center must match official registry manifest"]
  );

  writeReadiness(workspaceRoot, [
    {
      ...createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      latest_readiness_receipt:
        ".dx/receipts/extensions/dx.vscode.command-center/custom.json"
    },
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    [
      "readiness latest receipt for dx.vscode.command-center must be .dx/receipts/extensions/dx.vscode.command-center/readiness-latest.json"
    ]
  );

  writeReadiness(workspaceRoot, [
    {
      ...createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      stage: "preview"
    },
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    ["readiness stage for dx.vscode.command-center is unsupported: preview"]
  );

  writeReadiness(workspaceRoot, [
    {
      ...createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      blocked_by: []
    },
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    ["readiness blocked_by for dx.vscode.command-center must include at least one deferred proof"]
  );

  writeReadiness(workspaceRoot, [
    {
      ...createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      signing_receipt: ".dx/receipts/extensions/dx.vscode.command-center/signing.json"
    },
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    [
      "source-level readiness for dx.vscode.command-center must not claim release proof receipts"
    ]
  );

  writeReadiness(workspaceRoot, [
    {
      ...createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      stage: "release-ready",
      loaded_host_receipt: ".dx/receipts/extensions/dx.vscode.command-center/loaded-host.json",
      package_receipt: ".dx/receipts/extensions/dx.vscode.command-center/package.json",
      checksum_receipt: ".dx/receipts/extensions/dx.vscode.command-center/checksum.json",
      distribution_receipt:
        ".dx/receipts/extensions/dx.vscode.command-center/distribution.json",
      blocked_by: []
    },
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
  assertMessages(
    validateExtensionReadiness(workspaceRoot),
    ["release-ready readiness for dx.vscode.command-center requires signing_receipt"]
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("extension readiness validator verified");

function assertMessages(actualMessages, expectedMessages) {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeValidWorkspace(root) {
  mkdirSync(join(root, "registry"), { recursive: true });
  mkdirSync(join(root, "hosts", "vscode", "dx-vscode"), { recursive: true });
  mkdirSync(join(root, "hosts", "browser", "dx-browser"), { recursive: true });

  writeOfficialRegistry(root, [
    createRegistryEntry("dx.vscode.command-center", "DX VS Code Command Center", "hosts/vscode/dx-vscode"),
    createRegistryEntry("dx.browser.command-center", "DX Browser Command Center", "hosts/browser/dx-browser")
  ]);
  writeReadiness(root, [
    createReadinessEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
    createReadinessEntry("dx.browser.command-center", "hosts/browser/dx-browser")
  ]);
}

function createRegistryEntry(id, name, path) {
  return {
    id,
    name,
    path,
    manifest: `${path}/dx.extension.toml`,
    status: "experimental",
    professional_targets: ["fixture.host"]
  };
}

function createReadinessEntry(id, path, overrides = {}) {
  return {
    id,
    stage: "source-level",
    manifest: `${path}/dx.extension.toml`,
    source_guard: "test:source-fixture",
    latest_readiness_receipt: `.dx/receipts/extensions/${id}/readiness-latest.json`,
    next_proof: "capture loaded-host smoke receipt",
    blocked_by: ["loaded-host smoke receipt"],
    ...overrides
  };
}

function writeOfficialRegistry(root, entries) {
  const registrySource = [
    'schema = "dx.extensions.registry"',
    "manifest_version = 1",
    "",
    ...entries.map(formatRegistryEntry)
  ].join("\n");

  writeFileSync(join(root, "registry", "official-extensions.toml"), `${registrySource}\n`);
}

function writeReadiness(root, entries) {
  const readinessSource = [
    'schema = "dx.extension_readiness"',
    "manifest_version = 1",
    "",
    ...entries.map(formatReadinessEntry)
  ].join("\n");

  writeFileSync(join(root, "registry", "extension-readiness.toml"), `${readinessSource}\n`);
}

function formatRegistryEntry(entry) {
  return [
    "[[extensions]]",
    `id = "${entry.id}"`,
    `name = "${entry.name}"`,
    `path = "${entry.path}"`,
    `manifest = "${entry.manifest}"`,
    `status = "${entry.status}"`,
    `professional_targets = ${formatStringArray(entry.professional_targets)}`,
    ""
  ].join("\n");
}

function formatReadinessEntry(entry) {
  const lines = [
    "[[extensions]]",
    `id = "${entry.id}"`,
    `stage = "${entry.stage}"`,
    `manifest = "${entry.manifest}"`,
    `source_guard = "${entry.source_guard}"`,
    `latest_readiness_receipt = "${entry.latest_readiness_receipt}"`,
    `next_proof = "${entry.next_proof}"`,
    `blocked_by = ${formatStringArray(entry.blocked_by)}`
  ];

  for (const receiptKey of [
    "loaded_host_receipt",
    "package_receipt",
    "signing_receipt",
    "checksum_receipt",
    "distribution_receipt"
  ]) {
    if (entry[receiptKey] !== undefined) {
      lines.push(`${receiptKey} = "${entry[receiptKey]}"`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function formatStringArray(values) {
  return `[${values.map((value) => `"${value}"`).join(", ")}]`;
}
