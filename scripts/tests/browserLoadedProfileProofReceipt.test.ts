import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeBrowserLoadedProfileProofReceipts } from "../write-browser-loaded-profile-proof-receipts.ts";
import type { BrowserLoadedProfileTarget } from "../write-browser-loaded-profile-receipt.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-browser-loaded-profile-proof-"));

try {
  const packageOutputReceiptPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/package-output-latest.json",
    JSON.stringify({ receipt: "dx.extension.browser.package_output" }, null, 2)
  );
  const nativeHostManifestPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/native-host-manifest.json",
    JSON.stringify({ name: "dev.dx.browser" }, null, 2)
  );
  const nativeHostPackageReceiptPath = writeNativeHostPackageReceipt(nativeHostManifestPath);
  const hostActionIndexReceiptPath = writeHostActionIndexReceipt();
  const chromeExecutablePath = writeWorkspaceFile("tools/chrome.exe", "chrome executable\n");
  const edgeExecutablePath = writeWorkspaceFile("tools/msedge.exe", "edge executable\n");
  const firefoxExecutablePath = writeWorkspaceFile("tools/firefox.exe", "firefox executable\n");
  const proofPath = writeWorkspaceFile(
    "proof/browser-loaded-profiles.json",
    JSON.stringify(
      [
        loadedProfileProof(
          "chrome",
          chromeExecutablePath,
          packageOutputReceiptPath,
          nativeHostPackageReceiptPath,
          nativeHostManifestPath
        ),
        loadedProfileProof(
          "edge",
          edgeExecutablePath,
          packageOutputReceiptPath,
          nativeHostPackageReceiptPath,
          nativeHostManifestPath
        ),
        loadedProfileProof(
          "firefox",
          firefoxExecutablePath,
          packageOutputReceiptPath,
          nativeHostPackageReceiptPath,
          nativeHostManifestPath
        )
      ],
      null,
      2
    )
  );

  const receipts = writeBrowserLoadedProfileProofReceipts(workspaceRoot, {
    proofPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:browser-loaded-profile:j1"
  });

  assert.equal(receipts.length, 3);
  assert.deepEqual(
    receipts.map((receipt) => receipt.target).sort(),
    ["chrome", "edge", "firefox"]
  );
  assert.equal(receipts.every((receipt) => receipt.generatedAt === "2026-06-07T00:00:00.000Z"), true);
  assert.equal(receipts.every((receipt) => receipt.verificationCommand === "npm run smoke:browser-loaded-profile:j1"), true);
  assert.equal(receipts[0].receiptPath.endsWith("chrome-loaded-profile-latest.json"), true);
  assert.equal(receipts[1].receiptPath.endsWith("edge-loaded-profile-latest.json"), true);
  assert.equal(receipts[2].receiptPath.endsWith("firefox-loaded-profile-latest.json"), true);
  assert.equal(receipts.find((receipt) => receipt.target === "firefox")?.extension.baseUrl.startsWith("moz-extension://"), true);
  assert.equal(
    receipts.every((receipt) =>
      receipt.loadedProfile.nativeHostRoundTrips.every(
        (roundTrip) =>
          roundTrip.receiptSha256 === sha256(readFileSync(hostActionIndexReceiptPath))
      )
    ),
    true
  );
  assert.equal(receipts.every((receipt) => existsSync(receipt.receiptPath)), true);

  assert.throws(
    () =>
      writeBrowserLoadedProfileProofReceipts(workspaceRoot, {
        proofPath: join(workspaceRoot, "missing-browser-proof.json")
      }),
    /Browser loaded-profile proof JSON does not exist/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Browser loaded-profile proof receipts verified");

function loadedProfileProof(
  target: BrowserLoadedProfileTarget,
  browserExecutablePath: string,
  packageOutputReceiptPath: string,
  nativeHostPackageReceiptPath: string,
  nativeHostManifestPath: string
) {
  const extensionId =
    target === "chrome"
      ? "abcdefghijklmnopabcdefghijklmnop"
      : target === "edge"
        ? "bcdefghijklmnopabcdefghijklmnopa"
        : "dx-browser-command-center@dx.dev";
  const extensionScheme = target === "firefox" ? "moz-extension" : "chrome-extension";

  return {
    target,
    browserExecutablePath,
    browserVersion: "125.0.0.0",
    profilePath: join(workspaceRoot, "profiles", target),
    extensionId,
    extensionBaseUrl: `${extensionScheme}://${extensionId}/`,
    packageOutputReceiptPath,
    nativeHostPackageReceiptPath,
    nativeHostManifestPath,
    nativeHostName: "dev.dx.browser",
    loadedProfileVerified: true,
    loadedBackgroundServiceWorkerVerified: true,
    nativeHostRegistered: true,
    commandRoundTrips: [
      commandRoundTrip("status", "dx.browser.show_status"),
      commandRoundTrip("forgePackages", "dx.browser.list_forge_packages"),
      commandRoundTrip("showBuildGraph", "dx.browser.show_build_graph")
    ],
    hostUiCommandIds: ["openReceipts"]
  };
}

function writeNativeHostPackageReceipt(nativeHostManifestPath: string): string {
  const manifestSha256 = sha256(readFileSync(nativeHostManifestPath));

  return writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/native-host-release-package-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.browser.native_host_package",
        adapterId: "dx.browser.command-center",
        host: "browser",
        nativeHost: {
          executable: {
            path: join(workspaceRoot, "target", "release", "dx-browser-native-host.exe"),
            sha256: "d".repeat(64)
          },
          manifests: ["chrome", "edge", "firefox"].map((target) => ({
            target,
            manifestPath: nativeHostManifestPath,
            sha256: manifestSha256,
            name: "dev.dx.browser"
          }))
        }
      },
      null,
      2
    )
  );
}

function commandRoundTrip(commandId: "status" | "forgePackages" | "showBuildGraph", hostActionId: string) {
  return {
    commandId,
    hostActionId,
    handledBy: "native-host",
    ok: true,
    receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  };
}

function writeHostActionIndexReceipt(): string {
  return writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.host_action_index",
        adapterId: "dx.browser.command-center",
        host: "browser"
      },
      null,
      2
    )
  );
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
