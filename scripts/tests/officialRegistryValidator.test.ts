import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateOfficialExtensionRegistry } from "../validate-official-registry.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-official-registry-"));

try {
  writeValidWorkspace(workspaceRoot);

  assert.deepEqual(
    validateOfficialExtensionRegistry(workspaceRoot),
    [],
    "valid official registry entries should pass"
  );

  const { professional_targets: _omittedTargets, ...entryWithoutTargets } =
    createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode");
  writeOfficialRegistry(workspaceRoot, [
    entryWithoutTargets,
    createRegistryEntry("dx.browser.command-center", "hosts/browser/dx-browser", {
      name: "DX Browser Command Center",
      status: "experimental"
    })
  ]);
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["registry professional_targets for dx.vscode.command-center must include at least one target"]
  );

  writeOfficialRegistry(workspaceRoot, [
    {
      ...createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      professional_targets: []
    },
    createRegistryEntry("dx.browser.command-center", "hosts/browser/dx-browser", {
      name: "DX Browser Command Center",
      status: "experimental"
    })
  ]);
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["registry professional_targets for dx.vscode.command-center must include at least one target"]
  );

  writeOfficialRegistry(workspaceRoot, [
    {
      ...createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      professional_targets: ["unknown.host"]
    },
    createRegistryEntry("dx.browser.command-center", "hosts/browser/dx-browser", {
      name: "DX Browser Command Center",
      status: "experimental"
    })
  ]);
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    [
      "registry professional target for dx.vscode.command-center is not in professional host target catalog: unknown.host"
    ]
  );

  writeOfficialRegistry(
    workspaceRoot,
    [
      createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      createRegistryEntry("dx.vscode.command-center", "hosts/browser/dx-browser")
    ]
  );
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["duplicate registry extension id: dx.vscode.command-center"]
  );

  writeOfficialRegistry(
    workspaceRoot,
    [
      createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      {
        ...createRegistryEntry("dx.browser.command-center", "hosts/browser/dx-browser"),
        manifest: "hosts/vscode/dx-vscode/dx.extension.toml"
      }
    ]
  );
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["registry manifest for dx.browser.command-center must be under its path"]
  );

  writeOfficialRegistry(workspaceRoot, [
    {
      ...createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      manifest: "../outside.toml"
    }
  ]);
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["registry manifest for dx.vscode.command-center must be a safe relative path"]
  );

  writeOfficialRegistry(workspaceRoot, [
    {
      ...createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      status: "preview"
    }
  ]);
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["registry status for dx.vscode.command-center is unsupported: preview"]
  );

  writeOfficialRegistry(workspaceRoot, [
    {
      ...createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
      name: "Wrong Name"
    }
  ]);
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["registry name for dx.vscode.command-center must match manifest extension.name"]
  );

  writeManifest(workspaceRoot, "hosts/vscode/dx-vscode", {
    id: "dx.vscode.command-center",
    name: "DX VS Code Command Center",
    official: false
  });
  writeOfficialRegistry(workspaceRoot, [
    createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode")
  ]);
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    ["manifest for dx.vscode.command-center must declare official = true"]
  );

  writeValidWorkspace(workspaceRoot);
  mkdirSync(join(workspaceRoot, "hosts", "figma", "dx-figma"), { recursive: true });
  writeManifest(workspaceRoot, "hosts/figma/dx-figma", {
    id: "dx.figma.command-center",
    name: "DX Figma Command Center",
    official: true
  });
  assertMessages(
    validateOfficialExtensionRegistry(workspaceRoot),
    [
      "official manifest is missing from registry: hosts/figma/dx-figma/dx.extension.toml"
    ]
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("official registry validator verified");

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

  writeProfessionalHostTargets(root, [
    "vscode.extension-api",
    "browser.chrome-extensions"
  ]);
  writeManifest(root, "hosts/vscode/dx-vscode", {
    id: "dx.vscode.command-center",
    name: "DX VS Code Command Center",
    official: true
  });
  writeManifest(root, "hosts/browser/dx-browser", {
    id: "dx.browser.command-center",
    name: "DX Browser Command Center",
    official: true
  });
  writeOfficialRegistry(root, [
    createRegistryEntry("dx.vscode.command-center", "hosts/vscode/dx-vscode"),
    createRegistryEntry("dx.browser.command-center", "hosts/browser/dx-browser", {
      name: "DX Browser Command Center",
      status: "experimental"
    })
  ]);
}

function createRegistryEntry(id, path, overrides = {}) {
  return {
    id,
    name: id === "dx.vscode.command-center"
      ? "DX VS Code Command Center"
      : "DX Browser Command Center",
    path,
    manifest: `${path}/dx.extension.toml`,
    status: "active",
    professional_targets: id === "dx.vscode.command-center"
      ? ["vscode.extension-api"]
      : ["browser.chrome-extensions"],
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

  writeFileSync(join(root, "registry", "official-extensions.toml"), registrySource);
}

function formatRegistryEntry(entry) {
  const lines = [
    "[[extensions]]",
    `id = "${entry.id}"`,
    `name = "${entry.name}"`,
    `path = "${entry.path}"`,
    `manifest = "${entry.manifest}"`,
    `status = "${entry.status}"`
  ];

  if (entry.professional_targets !== undefined) {
    lines.push(`professional_targets = ${formatStringArray(entry.professional_targets)}`);
  }

  lines.push("");
  return lines.join("\n");
}

function writeProfessionalHostTargets(root, targetIds) {
  const source = [
    'schema = "dx.professional_host_targets"',
    "manifest_version = 1",
    "",
    ...targetIds.map((id) => [
      "[[targets]]",
      `id = "${id}"`,
      `name = "${id}"`,
      ""
    ].join("\n"))
  ].join("\n");

  writeFileSync(join(root, "registry", "professional-host-targets.toml"), source);
}

function formatStringArray(values) {
  return `[${values.map((value) => `"${value}"`).join(", ")}]`;
}

function writeManifest(root, extensionPath, extension) {
  const source = [
    'schema = "dx.extension.manifest"',
    "manifest_version = 1",
    "",
    "[extension]",
    `id = "${extension.id}"`,
    `name = "${extension.name}"`,
    'publisher = "DX"',
    'version = "0.1.0"',
    'description = "Fixture manifest."',
    'license = "MIT"',
    `official = ${extension.official}`,
    ""
  ].join("\n");

  writeFileSync(join(root, extensionPath, "dx.extension.toml"), source);
}
