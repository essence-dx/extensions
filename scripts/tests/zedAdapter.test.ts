import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const root = process.cwd();
const adapterRoot = join(root, "hosts", "zed", "dx-zed");
const dxManifestPath = join(adapterRoot, "dx.extension.toml");
const zedManifestPath = join(adapterRoot, "extension.toml");
const cargoManifestPath = join(adapterRoot, "Cargo.toml");
const cargoLockPath = join(adapterRoot, "Cargo.lock");
const commandPlansPath = join(adapterRoot, "src", "command_plans.rs");
const extensionSourcePath = join(adapterRoot, "src", "lib.rs");
const gitignorePath = join(adapterRoot, ".gitignore");
const readmePath = join(adapterRoot, "README.md");
const starterGuidePath = join(root, "docs", "zed-extension-starter.md");

for (const path of [
  dxManifestPath,
  zedManifestPath,
  cargoManifestPath,
  cargoLockPath,
  commandPlansPath,
  extensionSourcePath,
  gitignorePath,
  readmePath,
  starterGuidePath
]) {
  assert.equal(existsSync(path), true, `${path} should exist`);
}

const registrySource = readFileSync(join(root, "registry", "official-extensions.toml"), "utf8");
assert.match(registrySource, /id = "dx\.zed\.command-center"/);
assert.match(registrySource, /path = "hosts\/zed\/dx-zed"/);
assert.match(registrySource, /manifest = "hosts\/zed\/dx-zed\/dx\.extension\.toml"/);
assert.match(registrySource, /status = "experimental"/);

const packageSource = readFileSync(join(root, "package.json"), "utf8");
assert.match(packageSource, /"test:zed-adapter": "node --experimental-strip-types scripts\/tests\/zedAdapter\.test\.ts"/);

const testJ1Source = readFileSync(join(root, "scripts", "test-j1.ps1"), "utf8");
assert.match(testJ1Source, /Invoke-DxCommand "npm" @\("run", "test:zed-adapter"\)/);

const dxManifestSource = readFileSync(dxManifestPath, "utf8");
const dxManifest = parseTomlDocument(dxManifestSource);
assert.doesNotMatch(dxManifestSource, /scaffold|dev-extension proof|local-service proof/i);
assert.equal(dxManifest.sections.extension.id, "dx.zed.command-center");
assert.equal(dxManifest.sections.extension.name, "DX Zed Command Center");
assert.equal(dxManifest.sections.extension.official, true);
assert.deepEqual(dxManifest.sections.compatibility.hosts, ["zed"]);
assert.equal(dxManifest.sections.entrypoint.transport, "http");
assert.equal(dxManifest.sections.entrypoint.command, "dx-local-service");
assert.deepEqual(dxManifest.sections.entrypoint.args, []);
assert.equal(dxManifest.sections.security.signature, "development-unsigned");
assert.equal(dxManifest.sections.security.sandbox, "zed-wasm-extension");
assert.equal(dxManifest.sections.security.network, "deny-by-default");
assert.equal(dxManifest.sections.security.stores_payloads, false);
assert.equal(dxManifest.sections.security.stores_process_output, false);

const capabilityIds = (dxManifest.arrays.capabilities ?? []).map((capability) => capability.id);
assert.deepEqual(capabilityIds, [
  "zed.slash_commands",
  "local_service.connect",
  "receipts.read"
]);
assert.equal(capabilityIds.includes("process.spawn"), false);
assert.equal(capabilityIds.includes("process.exec"), false);
assert.equal(capabilityIds.includes("download_file"), false);
assert.equal(capabilityIds.includes("npm.install"), false);

const hostActions = dxManifest.arrays.host_actions ?? [];
assert.deepEqual(hostActions.map((action) => action.id), [
  "dx.zed.show_status",
  "dx.zed.search_assets",
  "dx.zed.show_receipts"
]);
assert.ok(hostActions.every((action) => action.transport !== "process"));

const receipt = dxManifest.arrays.receipts?.[0];
assert.equal(
  receipt.latest_path,
  ".dx/receipts/extensions/dx.zed.command-center/host-action-index-latest.json"
);
assert.equal(receipt.metadata_only, true);

const zedManifestSource = readFileSync(zedManifestPath, "utf8");
assert.match(zedManifestSource, /^id = "dx-command-center"$/m);
assert.match(zedManifestSource, /^name = "DX Command Center"$/m);
assert.match(zedManifestSource, /^schema_version = 1$/m);
assert.match(zedManifestSource, /^version = "0\.1\.0"$/m);
assert.doesNotMatch(zedManifestSource, /example\.invalid/i);
assert.match(zedManifestSource, /^\[slash_commands\.dx-status\]$/m);
assert.match(zedManifestSource, /^\[slash_commands\.dx-assets\]$/m);
assert.match(zedManifestSource, /^\[slash_commands\.dx-receipts\]$/m);
assert.match(zedManifestSource, /description = "Show DX status metadata"/);
assert.match(zedManifestSource, /description = "Search DX assets through the future local-service bridge"/);
assert.match(zedManifestSource, /description = "Show DX receipt path metadata"/);
assert.match(zedManifestSource, /requires_argument = true/);
assert.doesNotMatch(zedManifestSource, /\[context_servers\.|process:exec|download_file|npm:install|command = "\*"/i);

const cargoSource = readFileSync(cargoManifestPath, "utf8");
assert.match(cargoSource, /name = "dx-command-center"/);
assert.match(cargoSource, /crate-type = \["cdylib"\]/);
assert.match(cargoSource, /zed_extension_api = "0\.7\.0"/);
assert.match(cargoSource, /\[workspace\]/);
assert.doesNotMatch(cargoSource, /tokio|reqwest|ureq|std-process|serde_json|mcp/i);

const cargoLockSource = readFileSync(cargoLockPath, "utf8");
assert.match(cargoLockSource, /name = "dx-command-center"/);
assert.match(cargoLockSource, /name = "zed_extension_api"/);

const commandPlansSource = readFileSync(commandPlansPath, "utf8");
assert.match(commandPlansSource, /pub const DX_ZED_COMMAND_PLANS/);
assert.match(commandPlansSource, /slash_command:\s*"dx-status"/);
assert.match(commandPlansSource, /operation:\s*"dx\.status"/);
assert.match(commandPlansSource, /operation:\s*"dx\.status"[\s\S]*requires_runtime_proof:\s*true/);
assert.match(commandPlansSource, /slash_command:\s*"dx-assets"/);
assert.match(commandPlansSource, /operation:\s*"dx\.assets\.search"/);
assert.match(commandPlansSource, /operation:\s*"dx\.assets\.search"[\s\S]*requires_runtime_proof:\s*true/);
assert.match(commandPlansSource, /slash_command:\s*"dx-receipts"/);
assert.match(commandPlansSource, /operation:\s*"receipt\.showPath"/);
assert.match(
  commandPlansSource,
  /operation:\s*"receipt\.showPath"[\s\S]*transport:\s*"host-ui"[\s\S]*requires_runtime_proof:\s*false/
);
assert.doesNotMatch(commandPlansSource, /std::process|process::Command|Command::new|download_file|npm_install_package|latest_github_release|fetch|reqwest|ureq|shell|PowerShell|cmd\.exe|bash|sh -c/i);

const extensionSource = readFileSync(extensionSourcePath, "utf8");
assert.match(extensionSource, /zed::register_extension!\(DxZedExtension\)/);
assert.match(extensionSource, /impl zed::Extension for DxZedExtension/);
assert.match(extensionSource, /fn run_slash_command/);
assert.match(extensionSource, /SlashCommandOutput/);
assert.match(extensionSource, /command_plan_for\(command\.name\.as_str\(\)\)/);
assert.match(extensionSource, /DX service connection is not configured for this host/);
assert.doesNotMatch(extensionSource, /metadata only|scaffold/i);
assert.doesNotMatch(extensionSource, /std::process|process::Command|Command::new|context_server_command|language_server_command|get_dap_binary|download_file|npm_install_package|latest_github_release|fetch|reqwest|ureq|shell|PowerShell|cmd\.exe|bash|sh -c/i);

const gitignoreSource = readFileSync(gitignorePath, "utf8");
assert.match(gitignoreSource, /^\/target\//m);
assert.match(gitignoreSource, /^\/extension\.wasm$/m);
assert.match(gitignoreSource, /^\/archive\.tar\.gz$/m);

const readmeSource = readFileSync(readmePath, "utf8");
assert.match(readmeSource, /source-level only/i);
assert.match(readmeSource, /loaded Zed dev-extension smoke/i);
assert.match(readmeSource, /installed source path[\s\S]*Zed extension index[\s\S]*host log/i);
assert.match(readmeSource, /local-service proof remains deferred/i);
assert.match(readmeSource, /extension\.wasm[\s\S]*build:zed:j1/);
assert.match(readmeSource, /signing[\s\S]*checksum[\s\S]*remain deferred/i);
assert.doesNotMatch(readmeSource, /release[- ]ready|marketplace[- ]ready|gallery approved|published|installable/i);

const starterGuideSource = readFileSync(starterGuidePath, "utf8");
assert.match(starterGuideSource, /https:\/\/zed\.dev\/docs\/extensions\/developing-extensions/);
assert.match(starterGuideSource, /https:\/\/zed\.dev\/docs\/extensions\/slash-commands/);
assert.match(starterGuideSource, /https:\/\/zed\.dev\/docs\/extensions\/capabilities/);
assert.match(starterGuideSource, /zed_extension_api/);
assert.match(starterGuideSource, /not based on slash-command availability/i);
assert.match(starterGuideSource, /package-output receipt/i);
assert.match(starterGuideSource, /local-service proof remains deferred/i);
assert.match(starterGuideSource, /extension gallery submission remains deferred/i);

console.log("Zed adapter verified");
