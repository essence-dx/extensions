import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateOfficialExtensionStarterPolicy } from "../validate-extension-starter-policy.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-extension-starter-"));

try {
  mkdirSync(join(workspaceRoot, "docs"), { recursive: true });

  writeStarterGuide(workspaceRoot, validStarterGuide());
  assert.deepEqual(
    validateOfficialExtensionStarterPolicy(workspaceRoot),
    [],
    "complete official extension starter policy should pass"
  );

  writeStarterGuide(workspaceRoot, validStarterGuide().replace("registry-first", ""));
  assertMessages(
    validateOfficialExtensionStarterPolicy(workspaceRoot),
    ["official extension starter guide must require registry-first creation"]
  );

  writeStarterGuide(
    workspaceRoot,
    validStarterGuide().replace("host SDK and distribution evidence", "")
  );
  assertMessages(
    validateOfficialExtensionStarterPolicy(workspaceRoot),
    ["official extension starter guide must require host SDK and distribution evidence"]
  );

  writeStarterGuide(workspaceRoot, validStarterGuide().replace("j1 verification", ""));
  assertMessages(
    validateOfficialExtensionStarterPolicy(workspaceRoot),
    ["official extension starter guide must require j1 verification"]
  );

  writeStarterGuide(
    workspaceRoot,
    validStarterGuide().replace("does not prove marketplace readiness", "")
  );
  assertMessages(
    validateOfficialExtensionStarterPolicy(workspaceRoot),
    ["official extension starter guide must avoid marketplace readiness overclaims"]
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("official extension starter policy verified");

function assertMessages(actualMessages, expectedMessages) {
  for (const message of expectedMessages) {
    assert.ok(
      actualMessages.includes(message),
      `expected validation message: ${message}\nactual: ${actualMessages.join("\n")}`
    );
  }
}

function writeStarterGuide(root, source) {
  writeFileSync(join(root, "docs", "official-extension-starter.md"), source);
}

function validStarterGuide() {
  return [
    "# Official Extension Starter",
    "",
    "Every official DX extension starts from a registry-first proposal.",
    "",
    "Required evidence:",
    "",
    "- host SDK and distribution evidence",
    "- permission and sandbox model",
    "- DX CLI or local service boundary",
    "- manifest and registry identity",
    "- j1 verification",
    "- metadata-only receipts",
    "- package signing and checksums",
    "- loaded-host smoke plan",
    "",
    "This starter gate does not prove marketplace readiness."
  ].join("\n");
}
