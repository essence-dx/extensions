import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

export const workspaceRoot = process.cwd();

export interface DxManifestExpectation {
  id: string;
  name: string;
  hosts: string[];
  sandbox: string;
  network: string;
  capabilities: string[];
  hostActions: string[];
  receiptPath: string;
  entrypointCommand?: string;
  entrypointTransport?: string;
}

export interface RegistryExpectation {
  id: string;
  path: string;
  manifest: string;
  professionalTarget: string;
}

export function requireWorkspacePaths(relativePaths: string[]): void {
  for (const relativePath of relativePaths) {
    assert.equal(
      existsSync(join(workspaceRoot, relativePath)),
      true,
      `${relativePath} should exist`
    );
  }
}

export function readWorkspaceText(relativePath: string): string {
  return readFileSync(join(workspaceRoot, relativePath), "utf8");
}

export function readWorkspaceJson<T>(relativePath: string): T {
  return JSON.parse(readWorkspaceText(relativePath)) as T;
}

export function readDxManifest(relativePath: string): ReturnType<typeof parseTomlDocument> {
  return parseTomlDocument(readWorkspaceText(relativePath));
}

export function assertRegistryEntry(expectation: RegistryExpectation): void {
  const registrySource = readWorkspaceText("registry/official-extensions.toml");
  assert.match(registrySource, new RegExp(`id = "${escapeRegExp(expectation.id)}"`));
  assert.match(registrySource, new RegExp(`path = "${escapeRegExp(expectation.path)}"`));
  assert.match(
    registrySource,
    new RegExp(`manifest = "${escapeRegExp(expectation.manifest)}"`)
  );
  assert.match(registrySource, /status = "experimental"/);
  assert.match(
    registrySource,
    new RegExp(
      `professional_targets = \\["${escapeRegExp(expectation.professionalTarget)}"\\]`
    )
  );
}

export function assertPackageScript(name: string, testPath: string): void {
  const packageJson = JSON.parse(readWorkspaceText("package.json"));
  assert.equal(
    packageJson.scripts[name],
    `node --experimental-strip-types ${testPath}`
  );
}

export function assertJ1Script(scriptName: string): void {
  assert.match(
    readWorkspaceText("scripts/test-j1.ps1"),
    new RegExp(`Invoke-DxCommand "npm" @\\("run", "${escapeRegExp(scriptName)}"\\)`)
  );
}

export function assertDxManifest(
  manifest: ReturnType<typeof parseTomlDocument>,
  expectation: DxManifestExpectation
): void {
  assert.equal(manifest.root.schema, "dx.extension.manifest");
  assert.equal(manifest.root.manifest_version, 1);
  assert.equal(manifest.sections.extension.id, expectation.id);
  assert.equal(manifest.sections.extension.name, expectation.name);
  assert.equal(manifest.sections.extension.official, true);
  assert.deepEqual(manifest.sections.compatibility.hosts, expectation.hosts);
  assert.equal(
    manifest.sections.entrypoint.transport,
    expectation.entrypointTransport ?? "http"
  );
  assert.equal(
    manifest.sections.entrypoint.command,
    expectation.entrypointCommand ?? "dx-local-service"
  );
  assert.deepEqual(manifest.sections.entrypoint.args, []);
  assert.equal(manifest.sections.security.signature, "development-unsigned");
  assert.equal(manifest.sections.security.sandbox, expectation.sandbox);
  assert.equal(manifest.sections.security.network, expectation.network);
  assert.equal(manifest.sections.security.stores_payloads, false);
  assert.equal(manifest.sections.security.stores_process_output, false);

  const capabilityIds = (manifest.arrays.capabilities ?? []).map((capability) => capability.id);
  assert.deepEqual(capabilityIds, expectation.capabilities);
  assert.equal(capabilityIds.includes("process.spawn"), false);
  assert.equal(capabilityIds.includes("process.exec"), false);
  assert.equal(capabilityIds.includes("filesystem.write"), false);

  const hostActions = manifest.arrays.host_actions ?? [];
  assert.deepEqual(hostActions.map((action) => action.id), expectation.hostActions);
  assert.ok(hostActions.every((action) => action.transport !== "process"));
  assert.ok(hostActions.every((action) => action.writes_receipts === false));

  const receipt = manifest.arrays.receipts?.[0];
  assert.equal(receipt.latest_path, expectation.receiptPath);
  assert.equal(receipt.metadata_only, true);
}

export function assertSourceDoesNotMatch(relativePath: string, pattern: RegExp): void {
  assert.doesNotMatch(readWorkspaceText(relativePath), pattern, relativePath);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
