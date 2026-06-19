import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildVsCodeLoadedHostReceipt,
  buildLoadedHostEnvironment,
  buildVsCodeLaunchArguments,
  readExtensionIdentity,
  resolveVsCodeCommand,
  selectVsCodeCommandCandidate,
  createVsCodeSpawnCommand,
  formatVsCodeSpawnFailure,
  removeVsCodeSmokeRoot
} from "../smoke-vscode-loaded-host-j1.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-vscode-loaded-host-test-"));

try {
  const extensionRoot = join(workspaceRoot, "hosts", "vscode", "dx-vscode");
  const compiledTestPath = join(workspaceRoot, ".tmp", "loadedHostSmoke.cjs");
  const workspacePath = join(workspaceRoot, "workspace");
  const userDataPath = join(workspaceRoot, "user-data");
  const extensionsPath = join(workspaceRoot, "extensions");

  assert.equal(
    resolveVsCodeCommand({ DX_VSCODE_BIN: "G:\\Tools\\VSCode\\bin\\code.cmd" }),
    "G:\\Tools\\VSCode\\bin\\code.cmd",
    "DX_VSCODE_BIN should override PATH discovery"
  );
  assert.equal(
    selectVsCodeCommandCandidate(
      [
        "G:\\Dev\\Tools\\VSCode\\Microsoft VS Code\\bin\\code",
        "G:\\Dev\\Tools\\VSCode\\Microsoft VS Code\\bin\\code.cmd"
      ],
      "win32"
    ),
    "G:\\Dev\\Tools\\VSCode\\Microsoft VS Code\\bin\\code.cmd",
    "Windows VS Code discovery should prefer the launchable code.cmd shim"
  );
  assert.equal(
    selectVsCodeCommandCandidate(["/usr/local/bin/code"], "linux"),
    "/usr/local/bin/code",
    "non-Windows VS Code discovery should keep the first executable candidate"
  );
  assert.deepEqual(
    createVsCodeSpawnCommand("G:\\Tools\\VSCode\\bin\\code.cmd", ["--version"], "win32"),
    {
      file: "cmd.exe",
      args: ["/d", "/s", "/c", "call", "G:\\Tools\\VSCode\\bin\\code.cmd", "--version"]
    },
    "Windows .cmd VS Code launchers must run through cmd.exe call"
  );
  assert.deepEqual(
    createVsCodeSpawnCommand("G:\\Tools\\VSCode\\Code.exe", ["--version"], "win32"),
    {
      file: "G:\\Tools\\VSCode\\Code.exe",
      args: ["--version"]
    },
    "Windows .exe VS Code launchers should launch directly"
  );
  assert.match(
    formatVsCodeSpawnFailure({
      status: null,
      signal: null,
      error: new Error("spawnSync code.cmd EINVAL")
    }),
    /spawnSync code\.cmd EINVAL/,
    "VS Code smoke failures must include spawn error details"
  );
  const cleanupWarnings: string[] = [];
  assert.doesNotThrow(() =>
    removeVsCodeSmokeRoot(
      workspaceRoot,
      () => {
        throw Object.assign(new Error("locked by extension host"), { code: "EPERM" });
      },
      (message) => cleanupWarnings.push(message)
    )
  );
  assert.match(
    cleanupWarnings[0] ?? "",
    /could not remove temporary smoke folder/,
    "recoverable VS Code temp cleanup failures should be reported without failing the proof"
  );
  assert.throws(
    () =>
      removeVsCodeSmokeRoot(
        workspaceRoot,
        () => {
          throw Object.assign(new Error("unexpected cleanup failure"), { code: "EACCES" });
        },
        () => {}
      ),
    /unexpected cleanup failure/,
    "non-recoverable VS Code temp cleanup failures should still fail"
  );

  const identity = readExtensionIdentity({
    name: "dx-vscode",
    publisher: "dx-runtime",
    contributes: {
      commands: [
        { command: "dx.showStatus" },
        { command: "dx.openCommandCenter" }
      ]
    }
  });

  assert.equal(identity.extensionId, "dx-runtime.dx-vscode");
  assert.deepEqual(identity.commandIds, [
    "dx.showStatus",
    "dx.openCommandCenter"
  ]);

  assert.deepEqual(
    buildLoadedHostEnvironment(identity),
    {
      DX_VSCODE_SMOKE_EXTENSION_ID: "dx-runtime.dx-vscode",
      DX_VSCODE_SMOKE_EXPECTED_COMMANDS:
        '["dx.showStatus","dx.openCommandCenter"]'
    },
    "loaded-host smoke should pass only metadata through the environment"
  );

  assert.deepEqual(
    buildVsCodeLoadedHostReceipt({
      identity,
      packageOutput: {
        receiptPath: "G:/Dx/extensions/.dx/receipts/extensions/dx.vscode.command-center/package-output-latest.json",
        receiptSha256: "a".repeat(64),
        packageSha256: "b".repeat(64),
        vsixSha256: "c".repeat(64)
      },
      workspacePath
    }),
    {
      schema_version: "dx.extension.vscode_loaded_host_smoke.v1",
      adapterId: "dx.vscode.command-center",
      extension_id: "dx-runtime.dx-vscode",
      command_count: 2,
      commandIds: ["dx.showStatus", "dx.openCommandCenter"],
      packageOutput: {
        receiptPath: "G:/Dx/extensions/.dx/receipts/extensions/dx.vscode.command-center/package-output-latest.json",
        receiptSha256: "a".repeat(64),
        packageSha256: "b".repeat(64),
        vsixSha256: "c".repeat(64)
      },
      workspace_kind: "temporary",
      workspace_path: workspacePath.replaceAll("\\", "/"),
      loaded_host: "vscode",
      status: "passed",
      stores_process_output: false,
      releaseClaims: {
        loadedExtensionHostVerified: true,
        packageOutputVerified: true,
        localServiceVerified: false,
        signingVerified: false,
        releaseChecksumVerified: false,
        marketplaceReviewVerified: false,
        distributionVerified: false
      }
    },
    "loaded-host receipt should link to package-output proof and exact command IDs"
  );

  assert.deepEqual(
    buildVsCodeLaunchArguments({
      extensionRoot,
      compiledTestPath,
      workspacePath,
      userDataPath,
      extensionsPath
    }),
    [
      "--user-data-dir",
      userDataPath,
      "--extensions-dir",
      extensionsPath,
      "--disable-extensions",
      "--disable-workspace-trust",
      "--extensionDevelopmentPath",
      extensionRoot,
      "--extensionTestsPath",
      compiledTestPath,
      workspacePath
    ],
    "VS Code should launch an isolated extension-development host"
  );

  const rootPackage = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  );
  assert.equal(
    rootPackage.scripts["smoke:vscode-loaded-host"],
    "npm run smoke:vscode-loaded-host:j1"
  );
  assert.equal(
    rootPackage.scripts["smoke:vscode-loaded-host:j1"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-vscode-loaded-host-j1.ps1",
    "loaded-host smoke should route through the guarded j1 PowerShell wrapper"
  );

  const wrapperSource = readFileSync(
    new URL("../smoke-vscode-loaded-host-j1.ps1", import.meta.url),
    "utf8"
  );
  assert.match(wrapperSource, /Set-DxSerialBuildEnvironment/);
  assert.match(wrapperSource, /Assert-DxDriveSpace -MinimumFreeGiB 3/);
  assert.match(wrapperSource, /Assert-NoCompetingHeavyProcess/);
  assert.match(
    wrapperSource,
    /Invoke-DxCommand "npm" @\("--workspace", "dx-vscode", "run", "compile"\)/
  );
  assert.match(
    wrapperSource,
    /Invoke-DxCommand "node" @\("--experimental-strip-types", "scripts\/smoke-vscode-loaded-host-j1\.ts"\)/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("VS Code loaded-host smoke runner contract verified");
