import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "obsidian", "dx-command-center");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const obsidianManifestPath = join(adapterRoot, "manifest.json");
const commandRunnerPath = join(adapterRoot, "src", "dxCommandRunner.ts");
const pluginPath = join(adapterRoot, "src", "main.ts");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");

for (const path of [
  dxManifestPath,
  obsidianManifestPath,
  commandRunnerPath,
  pluginPath,
  gitignorePath,
  readmePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.obsidian\.command-center"/);
assert.match(registrySource, /path = "hosts\/obsidian\/dx-command-center"/);
assert.match(registrySource, /manifest = "hosts\/obsidian\/dx-command-center\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const testJ1Source = readFileSync(join(root, "scripts", "test-j1.ps1"), "utf8");
assert.match(testJ1Source, /Invoke-DxCommand "npm" @\("run", "test:obsidian-build-output"\)/);

const dxManifest = parseTomlDocument(readFileSync(dxManifestPath, "utf8"));
assert.equal(dxManifest.sections.extension.id, "dx.obsidian.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Obsidian Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["obsidian"]);
assert.equal(dxManifest.sections.entrypoint.command, "dx");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "obsidian-desktop-plugin");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const hostActionIds = (dxManifest.arrays.host_actions ?? []).map((action) => action.id);
assert.deepEqual(hostActionIds, [
  "dx.obsidian.show_status",
  "dx.obsidian.run_doctor",
  "dx.obsidian.copy_receipts_path"
]);

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.obsidian.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const obsidianManifest = JSON.parse(readFileSync(obsidianManifestPath, "utf8"));
assert.equal(obsidianManifest.id, "dx-command-center");
assert.equal(obsidianManifest.name, "DX Command Center");
assert.equal(obsidianManifest.version, "0.1.0");
assert.equal(obsidianManifest.isDesktopOnly, true);
assert.equal(obsidianManifest.id, basename(adapterRoot));
assert.doesNotMatch(obsidianManifest.id, /obsidian/i);

const commandRunnerSource = readFileSync(commandRunnerPath, "utf8");
assert.match(
  commandRunnerSource,
  /DX_COMMANDS[\s\S]*=\s*{[\s\S]*status:\s*\["status"\][\s\S]*doctor:\s*\["doctor"\]/
);
assert.match(commandRunnerSource, /spawn\(\s*DX_EXECUTABLE/);
assert.match(commandRunnerSource, /shell:\s*false/);
assert.match(commandRunnerSource, /stdio:\s*"ignore"/);
assert.match(commandRunnerSource, /windowsHide:\s*true/);
assert.match(commandRunnerSource, /timeoutMs:\s*90000/);
assert.doesNotMatch(commandRunnerSource, /exec\(/);
assert.doesNotMatch(commandRunnerSource, /execFile\(/);
assert.doesNotMatch(commandRunnerSource, /shell:\s*true/);

const pluginSource = readFileSync(pluginPath, "utf8");
assert.match(pluginSource, /extends Plugin/);
assert.match(pluginSource, /addCommand\(\{[\s\S]*id:\s*"dx-show-status"/);
assert.match(pluginSource, /addCommand\(\{[\s\S]*id:\s*"dx-run-doctor"/);
assert.match(pluginSource, /addCommand\(\{[\s\S]*id:\s*"dx-copy-receipts-path"/);
assert.match(pluginSource, /class DxConfirmationModal extends Modal/);
assert.match(pluginSource, /navigator\.clipboard\.writeText/);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/main\.js$/m);
assert.match(gitignoreSource, /^\/main\.js\.map$/m);

console.log("Obsidian adapter verified");
