import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeBrowserHostActionIndexReceipt } from "../write-browser-host-action-index-receipt.ts";

const workspaceRoot = process.cwd();
const receiptRoot = mkdtempSync(join(tmpdir(), "dx-browser-host-action-index-"));
const receiptPath = join(receiptRoot, "host-action-index-latest.json");

try {
  const receipt = writeBrowserHostActionIndexReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    receiptPath,
    verificationCommand: "npm run test:browser-host-action-index-receipt"
  });

  assert.equal(receipt.receipt, "dx.extension.host_action_index");
  assert.equal(receipt.adapterId, "dx.browser.command-center");
  assert.equal(receipt.host, "browser");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run test:browser-host-action-index-receipt");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.manifest.path, "hosts/browser/dx-browser/dx.extension.toml");
  assert.equal(receipt.manifest.actionCount, 5);
  assert.equal(receipt.runtimePlanParity, true);
  assert.equal(receipt.nativeHostActionCount, 4);
  assert.equal(receipt.hostUiActionCount, 1);
  assert.deepEqual(
    receipt.actions.map((action) => ({
      id: action.id,
      operation: action.operation,
      transport: action.transport,
      riskLevel: action.riskLevel,
      requiresUserApproval: action.requiresUserApproval,
      runtimePlanId: action.runtimePlanId
    })),
    [
      {
        id: "dx.browser.show_status",
        operation: "dx.status",
        transport: "native-host",
        riskLevel: "low",
        requiresUserApproval: false,
        runtimePlanId: "status"
      },
      {
        id: "dx.browser.run_doctor",
        operation: "dx.doctor",
        transport: "native-host",
        riskLevel: "medium",
        requiresUserApproval: true,
        runtimePlanId: "doctor"
      },
      {
        id: "dx.browser.list_forge_packages",
        operation: "dx.forge.packages.list",
        transport: "native-host",
        riskLevel: "low",
        requiresUserApproval: false,
        runtimePlanId: "forgePackages"
      },
      {
        id: "dx.browser.show_build_graph",
        operation: "dx.graph.read",
        transport: "native-host",
        riskLevel: "low",
        requiresUserApproval: false,
        runtimePlanId: "showBuildGraph"
      },
      {
        id: "dx.browser.open_receipts",
        operation: "receipt.openFolder",
        transport: "host-ui",
        riskLevel: "low",
        requiresUserApproval: false,
        runtimePlanId: "openReceipts"
      }
    ]
  );
  assert.deepEqual(receipt.releaseClaims, {
    loadedChromeProfileVerified: false,
    loadedEdgeProfileVerified: false,
    loadedFirefoxProfileVerified: false,
    nativeHostReleasePackageVerified: false,
    releaseGateSatisfied: false
  });
  assert.equal(existsSync(receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(receiptRoot, { recursive: true, force: true });
}

assertManifestRuntimeDriftFails();
assertJ1WrapperContract();

console.log("Browser host action index receipt verified");

function assertManifestRuntimeDriftFails(): void {
  const malformedRoot = mkdtempSync(join(tmpdir(), "dx-browser-host-action-index-drift-"));

  try {
    const manifestPath = join(malformedRoot, "dx.extension.toml");
    writeFile(manifestPath, readFileSync(join(workspaceRoot, "hosts/browser/dx-browser/dx.extension.toml"), "utf8")
      .replace("operation = \"dx.status\"", "operation = \"dx.status.changed\""));

    assert.throws(
      () =>
        writeBrowserHostActionIndexReceipt(workspaceRoot, {
          manifestPath,
          receiptPath: join(malformedRoot, "receipt.json")
        }),
      /does not match runtime plan status/
    );
  } finally {
    rmSync(malformedRoot, { recursive: true, force: true });
  }
}

function writeFile(path: string, source: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

function assertJ1WrapperContract(): void {
  const packageJson = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8"));

  assert.equal(
    packageJson.scripts["write:browser-host-action-index-receipt"],
    "npm run write:browser-host-action-index-receipt:j1"
  );
  assert.equal(
    packageJson.scripts["write:browser-host-action-index-receipt:j1"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/write-browser-host-action-index-receipt-j1.ps1"
  );

  const wrapperSource = readFileSync(
    join(workspaceRoot, "scripts", "write-browser-host-action-index-receipt-j1.ps1"),
    "utf8"
  );
  const serialIndex = wrapperSource.indexOf("Set-DxSerialBuildEnvironment");
  const guardIndex = wrapperSource.indexOf("Assert-NoCompetingHeavyProcess");
  const pushLocationIndex = wrapperSource.indexOf("Push-Location");
  const testIndex = wrapperSource.indexOf('Invoke-DxCommand "npm" @("run", "test:browser-host-action-index-receipt")');
  const writerIndex = wrapperSource.indexOf(
    'Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-browser-host-action-index-receipt.ts")'
  );
  const ignoreCheckIndex = wrapperSource.indexOf('Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")');

  assert.notEqual(serialIndex, -1, "Browser host-action-index wrapper must set the serial build environment.");
  assert.notEqual(guardIndex, -1, "Browser host-action-index wrapper must reject competing heavy processes.");
  assert.notEqual(pushLocationIndex, -1, "Browser host-action-index wrapper must enter the workspace explicitly.");
  assert.ok(
    serialIndex < guardIndex && guardIndex < pushLocationIndex,
    "Browser host-action-index wrapper must run the process guard before entering the workspace."
  );
  assert.notEqual(testIndex, -1, "Browser host-action-index wrapper must test the receipt writer before writing.");
  assert.notEqual(writerIndex, -1, "Browser host-action-index wrapper must invoke the receipt writer.");
  assert.notEqual(ignoreCheckIndex, -1, "Browser host-action-index wrapper must verify generated-output ignore policy.");
  assert.ok(
    testIndex < writerIndex && writerIndex < ignoreCheckIndex,
    "Browser host-action-index wrapper must test, write, then verify generated-output ignore policy."
  );

  const smokeWrapperSource = readFileSync(
    join(workspaceRoot, "scripts", "smoke-browser-loaded-profile-j1.ps1"),
    "utf8"
  );
  const hostActionIndexWriterIndex = smokeWrapperSource.indexOf(
    'Invoke-DxCommand "npm" @("run", "write:browser-host-action-index-receipt:j1")'
  );
  const liveSmokeIndex = smokeWrapperSource.lastIndexOf("Invoke-LiveBrowserLoadedProfileSmoke");
  const proofWriterIndex = smokeWrapperSource.indexOf(
    'Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-browser-loaded-profile-proof-receipts.ts")'
  );

  assert.notEqual(
    hostActionIndexWriterIndex,
    -1,
    "Browser loaded-profile smoke must refresh the host-action-index receipt through the guarded j1 writer."
  );
  assert.ok(
    hostActionIndexWriterIndex < liveSmokeIndex && hostActionIndexWriterIndex < proofWriterIndex,
    "Browser loaded-profile smoke must refresh host-action-index proof before live or supplied-profile proof."
  );

  const nativeHostSmokeWrapperSource = readFileSync(
    join(workspaceRoot, "scripts", "smoke-browser-native-host-j1.ps1"),
    "utf8"
  );
  const nativeHostSmokeActionIndexWriterIndex = nativeHostSmokeWrapperSource.indexOf(
    'Invoke-DxCommand "npm" @("run", "write:browser-host-action-index-receipt:j1")'
  );
  const nativeHostBinarySmokeIndex = nativeHostSmokeWrapperSource.indexOf(
    'Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:native-host-binary-smoke")'
  );
  const loadedDispatchSmokeIndex = nativeHostSmokeWrapperSource.indexOf(
    'Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:loaded-browser-dispatch-smoke")'
  );
  const forgeManifestIndex = nativeHostSmokeWrapperSource.indexOf("forge.package_manifest");
  const workingDirectoryEnvIndex = nativeHostSmokeWrapperSource.indexOf(
    "DX_BROWSER_NATIVE_HOST_WORKING_DIR"
  );
  const cleanupIndex = nativeHostSmokeWrapperSource.indexOf(
    "Remove-DxBrowserNativeHostForgeWorkspace"
  );
  const bomFreeJsonWriterIndex = nativeHostSmokeWrapperSource.indexOf(
    "UTF8Encoding]::new($false)"
  );

  assert.notEqual(
    nativeHostSmokeActionIndexWriterIndex,
    -1,
    "Browser native-host smoke must refresh the host-action-index receipt through the guarded j1 writer."
  );
  assert.notEqual(
    forgeManifestIndex,
    -1,
    "Browser native-host smoke must create a minimal Forge manifest for package-list round trips."
  );
  assert.notEqual(
    workingDirectoryEnvIndex,
    -1,
    "Browser native-host smoke must pass a hermetic DX working directory to the native host."
  );
  assert.notEqual(
    cleanupIndex,
    -1,
    "Browser native-host smoke must clean up its temporary Forge workspace."
  );
  assert.notEqual(
    bomFreeJsonWriterIndex,
    -1,
    "Browser native-host smoke must write Forge fixture JSON without a UTF-8 BOM."
  );
  assert.ok(
    nativeHostSmokeActionIndexWriterIndex < nativeHostBinarySmokeIndex &&
      nativeHostSmokeActionIndexWriterIndex < loadedDispatchSmokeIndex,
    "Browser native-host smoke must refresh host-action-index proof before binary and dispatch smokes."
  );
}
