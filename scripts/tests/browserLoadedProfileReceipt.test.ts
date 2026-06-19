import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeBrowserLoadedProfileReceipt } from "../write-browser-loaded-profile-receipt.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-browser-loaded-profile-"));

try {
  const packageReceiptPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/package-output-latest.json",
    JSON.stringify({ receipt: "dx.extension.browser.package_output" }, null, 2)
  );
  const nativeHostManifestPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/native-host-manifest-edge.json",
    JSON.stringify({ name: "dev.dx.browser" }, null, 2)
  );
  const nativeHostPackageReceiptPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/native-host-release-package-latest.json",
    JSON.stringify(
      {
        receipt: "dx.extension.browser.native_host_package",
        adapterId: "dx.browser.command-center",
        host: "browser",
        nativeHost: {
          executable: {
            path: join(workspaceRoot, "target", "release", "dx-browser-native-host.exe"),
            sha256: "b".repeat(64)
          },
          manifests: [
            {
              target: "edge",
              manifestPath: nativeHostManifestPath,
              sha256: createHash("sha256").update(readFileSync(nativeHostManifestPath)).digest("hex"),
              name: "dev.dx.browser"
            }
          ]
        }
      },
      null,
      2
    )
  );
  const hostActionIndexReceiptPath = writeHostActionIndexReceipt();
  const browserExecutablePath = writeWorkspaceFile("tools/msedge.exe", "edge executable\n");
  const profilePath = join(workspaceRoot, "profiles", "edge-smoke");
  mkdirSync(profilePath, { recursive: true });

  const receipt = writeBrowserLoadedProfileReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:browser-loaded-profile:j1 -- --target edge",
    proof: {
      target: "edge",
      browserExecutablePath,
      browserVersion: "125.0.0.0",
      profilePath,
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      extensionBaseUrl: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/",
      packageOutputReceiptPath: packageReceiptPath,
      nativeHostPackageReceiptPath,
      nativeHostManifestPath,
      nativeHostName: "dev.dx.browser",
      loadedProfileVerified: true,
      loadedBackgroundServiceWorkerVerified: true,
      nativeHostRegistered: true,
      commandRoundTrips: [
        {
          commandId: "status",
          hostActionId: "dx.browser.show_status",
          handledBy: "native-host",
          ok: true,
          receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
        },
        {
          commandId: "forgePackages",
          hostActionId: "dx.browser.list_forge_packages",
          handledBy: "native-host",
          ok: true,
          receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
        },
        {
          commandId: "showBuildGraph",
          hostActionId: "dx.browser.show_build_graph",
          handledBy: "native-host",
          ok: true,
          receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
        }
      ],
      hostUiCommandIds: ["openReceipts"]
    }
  });

  assert.equal(receipt.receipt, "dx.extension.browser.loaded_profile");
  assert.equal(receipt.adapterId, "dx.browser.command-center");
  assert.equal(receipt.host, "browser");
  assert.equal(receipt.target, "edge");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.receiptPath.endsWith("edge-loaded-profile-latest.json"), true);
  assert.equal(receipt.browser.executablePath, browserExecutablePath);
  assert.equal(receipt.browser.version, "125.0.0.0");
  assert.equal(receipt.browser.profileKind, "temporary");
  assert.equal(receipt.browser.profilePath, profilePath);
  assert.equal(receipt.extension.id, "abcdefghijklmnopabcdefghijklmnop");
  assert.equal(receipt.extension.baseUrl, "chrome-extension://abcdefghijklmnopabcdefghijklmnop/");
  assert.equal(receipt.packageOutput.receiptPath, packageReceiptPath);
  assert.equal(
    receipt.packageOutput.receiptSha256,
    createHash("sha256").update(readFileSync(packageReceiptPath)).digest("hex")
  );
  assert.deepEqual(receipt.nativeHost, {
    name: "dev.dx.browser",
    manifestPath: nativeHostManifestPath,
    registered: true
  });
  assert.deepEqual(receipt.nativeHostPackage, {
    receiptPath: nativeHostPackageReceiptPath,
    receiptSha256: createHash("sha256").update(readFileSync(nativeHostPackageReceiptPath)).digest("hex"),
    target: "edge",
    manifestPath: nativeHostManifestPath,
    manifestSha256: createHash("sha256").update(readFileSync(nativeHostManifestPath)).digest("hex"),
    executableSha256: "b".repeat(64)
  });
  assert.deepEqual(
    receipt.loadedProfile.commandIds,
    ["status", "forgePackages", "showBuildGraph"]
  );
  assert.equal(receipt.loadedProfile.nativeHostRoundTrips.length, 3);
  assert.equal(
    receipt.loadedProfile.nativeHostRoundTrips.every(
      (roundTrip) =>
        roundTrip.receiptPath === ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json" &&
        roundTrip.receiptSha256 === sha256(readFileSync(hostActionIndexReceiptPath))
    ),
    true
  );
  assert.deepEqual(receipt.releaseClaims, {
    nativeHostReleasePackageVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    storeDistributionVerified: false
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  assert.throws(
    () =>
      writeBrowserLoadedProfileReceipt(workspaceRoot, {
        proof: {
          ...receiptFixture(packageReceiptPath, nativeHostManifestPath, browserExecutablePath, profilePath),
          nativeHostPackageReceiptPath,
          loadedProfileVerified: false
        }
      }),
    /loaded profile proof must come from a real launched browser profile/
  );
  assert.throws(
    () =>
      writeBrowserLoadedProfileReceipt(workspaceRoot, {
        proof: {
          ...receiptFixture(packageReceiptPath, nativeHostManifestPath, browserExecutablePath, profilePath),
          nativeHostPackageReceiptPath,
          commandRoundTrips: []
        }
      }),
    /must verify native-host round trips for status, forgePackages, showBuildGraph/
  );
  assert.throws(
    () => {
      const proof = receiptFixture(packageReceiptPath, nativeHostManifestPath, browserExecutablePath, profilePath);

      writeBrowserLoadedProfileReceipt(workspaceRoot, {
        proof: {
          ...proof,
          target: "edge",
          extensionId: "bcdefghijklmnopabcdefghijklmnopa",
          extensionBaseUrl: "chrome-extension://bcdefghijklmnopabcdefghijklmnopa/",
          nativeHostPackageReceiptPath,
          commandRoundTrips: proof.commandRoundTrips.map((roundTrip) => ({
            ...roundTrip,
            receiptPath: ".dx/receipts/extensions/dx.browser.command-center/missing-round-trip.json"
          }))
        }
      });
    },
    /command receipt does not exist/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Browser loaded-profile receipt verified");

function receiptFixture(
  packageOutputReceiptPath: string,
  nativeHostManifestPath: string,
  browserExecutablePath: string,
  profilePath: string,
  nativeHostPackageReceiptPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/native-host-release-package-fixture.json",
    JSON.stringify({
      receipt: "dx.extension.browser.native_host_package",
      adapterId: "dx.browser.command-center",
      host: "browser",
      nativeHost: {
        executable: {
          path: join(workspaceRoot, "target", "release", "dx-browser-native-host.exe"),
          sha256: "c".repeat(64)
        },
        manifests: [
          {
            target: "chrome",
            manifestPath: nativeHostManifestPath,
            sha256: createHash("sha256").update(readFileSync(nativeHostManifestPath)).digest("hex"),
            name: "dev.dx.browser"
          }
        ]
      }
    })
  )
): Parameters<typeof writeBrowserLoadedProfileReceipt>[1]["proof"] {
  return {
    target: "chrome",
    browserExecutablePath,
    browserVersion: "125.0.0.0",
    profilePath,
    extensionId: "abcdefghijklmnopabcdefghijklmnop",
    extensionBaseUrl: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/",
    packageOutputReceiptPath,
    nativeHostPackageReceiptPath,
    nativeHostManifestPath,
    nativeHostName: "dev.dx.browser",
    loadedProfileVerified: true,
    loadedBackgroundServiceWorkerVerified: true,
    nativeHostRegistered: true,
    commandRoundTrips: [
      {
        commandId: "status",
        hostActionId: "dx.browser.show_status",
        handledBy: "native-host",
        ok: true,
        receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      },
      {
        commandId: "forgePackages",
        hostActionId: "dx.browser.list_forge_packages",
        handledBy: "native-host",
        ok: true,
        receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      },
      {
        commandId: "showBuildGraph",
        hostActionId: "dx.browser.show_build_graph",
        handledBy: "native-host",
        ok: true,
        receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
      }
    ],
    hostUiCommandIds: []
  };
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
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

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
