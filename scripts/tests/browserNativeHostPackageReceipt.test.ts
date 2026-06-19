import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeBrowserPackageOutputReceipt } from "../write-browser-package-output-receipt.ts";
import { writeBrowserNativeHostPackageReceipt } from "../write-browser-native-host-package-receipt.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-browser-native-host-package-"));
const brandedIconSource = "<svg><title>DX</title></svg>\n";

try {
  writeBrowserReleaseGate();
  const packageRoot = join(workspaceRoot, "browser-package");
  writeBrowserPackageFiles(packageRoot);
  const packageOutputReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    "dx.browser.command-center",
    "package-output-latest.json"
  );
  const packageOutputReceipt = writeBrowserPackageOutputReceipt({
    packageRoot,
    receiptPath: packageOutputReceiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:browser:j1"
  });
  const nativeHostBinaryPath = writeWorkspaceFile(
    "target/release/dx-browser-native-host.exe",
    "native host executable bytes\n"
  );
  const manifestPaths = writeNativeHostManifests(nativeHostBinaryPath);
  const extensionIdCaptureReceiptPath = writeExtensionIdCaptureReceipt({
    chromeExtensionId: "abcdefghijklmnopabcdefghijklmnop",
    edgeExtensionId: "bcdefghijklmnopabcdefghijklmnopa"
  });
  const receipt = writeBrowserNativeHostPackageReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:browser-native-host:j1",
    proof: {
      targetOs: "windows",
      targetArch: "x64",
      hostName: "dev.dx.browser",
      nativeHostBinaryPath,
      packageOutputReceiptPath,
      extensionIdCaptureReceiptPath,
      manifestPaths
    }
  });

  assert.equal(receipt.receipt, "dx.extension.browser.native_host_package");
  assert.equal(receipt.adapterId, "dx.browser.command-center");
  assert.equal(receipt.host, "browser");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run package:browser-native-host:j1");
  assert.equal(
    receipt.receiptPath,
    join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      "dx.browser.command-center",
      "native-host-release-package-latest.json"
    )
  );
  assert.deepEqual(receipt.packageOutput, {
    receiptPath: packageOutputReceiptPath,
    receiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
    packageSha256: packageOutputReceipt.package.sha256,
    filesVerified: packageOutputReceipt.package.fileCount
  });
  assert.deepEqual(receipt.extensionIdCapture, {
    receiptPath: extensionIdCaptureReceiptPath,
    receiptSha256: sha256(readFileSync(extensionIdCaptureReceiptPath)),
    capturedTargets: ["chrome", "edge"],
    chromeExtensionId: "abcdefghijklmnopabcdefghijklmnop",
    edgeExtensionId: "bcdefghijklmnopabcdefghijklmnopa"
  });
  assert.deepEqual(receipt.nativeHost.executable, {
    path: nativeHostBinaryPath,
    fileName: "dx-browser-native-host.exe",
    targetOs: "windows",
    targetArch: "x64",
    bytes: Buffer.byteLength("native host executable bytes\n"),
    sha256: sha256(readFileSync(nativeHostBinaryPath))
  });
  assert.deepEqual(
    receipt.nativeHost.manifests.map((manifest) => manifest.target),
    ["chrome", "edge", "firefox"]
  );
  assert.equal(receipt.nativeHost.manifests.every((manifest) => manifest.name === "dev.dx.browser"), true);
  assert.equal(receipt.nativeHost.manifests.every((manifest) => manifest.type === "stdio"), true);
  assert.equal(receipt.nativeHost.manifests.every((manifest) => manifest.nativeHostPath === nativeHostBinaryPath), true);
  assert.deepEqual(receipt.nativeHost.manifests[0].allowedOrigins, [
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop/"
  ]);
  assert.deepEqual(receipt.nativeHost.manifests[1].allowedOrigins, [
    "chrome-extension://bcdefghijklmnopabcdefghijklmnopa/"
  ]);
  assert.deepEqual(receipt.nativeHost.manifests[2].allowedExtensions, [
    "dx-browser-command-center@dx.dev"
  ]);
  assert.equal(receipt.nativeHost.manifests[2].extensionId, "dx-browser-command-center@dx.dev");
  assert.deepEqual(receipt.releaseClaims, {
    packageOutputVerified: true,
    nativeHostReleasePackageVerified: true,
    loadedChromeProfileVerified: false,
    loadedEdgeProfileVerified: false,
    loadedFirefoxProfileVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    storeDistributionVerified: false
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);

  writeExtensionIdCaptureReceipt({
    chromeExtensionId: "ponmlkjihgfedcbaponmlkjihgfedcba",
    edgeExtensionId: "bcdefghijklmnopabcdefghijklmnopa"
  });
  assert.throws(
    () =>
      writeBrowserNativeHostPackageReceipt(workspaceRoot, {
        proof: {
          targetOs: "windows",
          targetArch: "x64",
          hostName: "dev.dx.browser",
          nativeHostBinaryPath,
          packageOutputReceiptPath,
          extensionIdCaptureReceiptPath,
          manifestPaths
        }
      }),
    /chrome manifest must match captured Chrome extension id/
  );
  writeExtensionIdCaptureReceipt({
    chromeExtensionId: "abcdefghijklmnopabcdefghijklmnop",
    edgeExtensionId: "bcdefghijklmnopabcdefghijklmnopa"
  });

  writeWorkspaceFile(
    "native-host-manifests/firefox/dev.dx.browser.json",
    JSON.stringify({
      name: "dev.dx.browser",
      description: "DX Browser native messaging host",
      path: nativeHostBinaryPath,
      type: "stdio",
      allowed_extensions: ["stale-browser-command-center@dx.dev"]
    })
  );
  assert.throws(
    () =>
      writeBrowserNativeHostPackageReceipt(workspaceRoot, {
        proof: {
          targetOs: "windows",
          targetArch: "x64",
          hostName: "dev.dx.browser",
          nativeHostBinaryPath,
          packageOutputReceiptPath,
          extensionIdCaptureReceiptPath,
          manifestPaths
        }
      }),
    /firefox manifest must match packaged Firefox extension id/
  );
  writeWorkspaceFile(
    "native-host-manifests/firefox/dev.dx.browser.json",
    JSON.stringify({
      name: "dev.dx.browser",
      description: "DX Browser native messaging host",
      path: nativeHostBinaryPath,
      type: "stdio",
      allowed_extensions: ["dx-browser-command-center@dx.dev"]
    })
  );

  writeWorkspaceFile(
    "native-host-manifests/chrome/dev.dx.browser.json",
    JSON.stringify({
      name: "dev.dx.browser",
      description: "DX Browser native messaging host",
      path: nativeHostBinaryPath,
      type: "stdio",
      allowed_origins: ["chrome-extension://{{DX_BROWSER_EXTENSION_ID}}/"]
    })
  );
  assert.throws(
    () =>
      writeBrowserNativeHostPackageReceipt(workspaceRoot, {
        proof: {
          targetOs: "windows",
          targetArch: "x64",
          hostName: "dev.dx.browser",
          nativeHostBinaryPath,
          packageOutputReceiptPath,
          extensionIdCaptureReceiptPath,
          manifestPaths
        }
      }),
    /must use explicit extension ids/
  );

  writeWorkspaceFile(
    "native-host-manifests/chrome/dev.dx.browser.json",
    JSON.stringify({
      name: "dev.dx.browser",
      description: "DX Browser native messaging host",
      path: join(workspaceRoot, "wrong-native-host.exe"),
      type: "stdio",
      allowed_origins: ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/"]
    })
  );
  assert.throws(
    () =>
      writeBrowserNativeHostPackageReceipt(workspaceRoot, {
        proof: {
          targetOs: "windows",
          targetArch: "x64",
          hostName: "dev.dx.browser",
          nativeHostBinaryPath,
          packageOutputReceiptPath,
          extensionIdCaptureReceiptPath,
          manifestPaths
        }
      }),
    /manifest path must match the native-host executable/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Browser native-host package receipt verified");

function writeBrowserReleaseGate(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "dx.browser.command-center"
name = "dx.browser.command-center"
path = "hosts/browser/dx-browser"
manifest = "hosts/browser/dx-browser/dx.extension.toml"
status = "experimental"
professional_targets = ["browser.chrome", "browser.edge", "browser.firefox"]
`
  );
  writeWorkspaceFile(
    "hosts/browser/dx-browser/dx.extension.toml",
    `
[extension]
id = "dx.browser.command-center"
`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "dx.browser.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "native_host_package", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.browser.command-center/chrome-loaded-profile-latest.json", "host_execution=.dx/receipts/extensions/dx.browser.command-center/edge-loaded-profile-latest.json", "host_execution=.dx/receipts/extensions/dx.browser.command-center/firefox-loaded-profile-latest.json", "package_output=.dx/receipts/extensions/dx.browser.command-center/package-output-latest.json", "native_host_package=.dx/receipts/extensions/dx.browser.command-center/native-host-release-package-latest.json", "signing=.dx/receipts/extensions/dx.browser.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.browser.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.browser.command-center/store-distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.browser.command-center/chrome-loaded-profile-latest.json", ".dx/receipts/extensions/dx.browser.command-center/edge-loaded-profile-latest.json", ".dx/receipts/extensions/dx.browser.command-center/firefox-loaded-profile-latest.json", ".dx/receipts/extensions/dx.browser.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.browser.command-center/native-host-release-package-latest.json", ".dx/receipts/extensions/dx.browser.command-center/signing-latest.json", ".dx/receipts/extensions/dx.browser.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.browser.command-center/store-distribution-latest.json"]
next_release_proof = "package native host"
blocked_by = ["native-host package proof"]
`
  );
}

function writeBrowserPackageFiles(packageRoot: string): void {
  for (const target of ["chromium", "edge", "firefox"]) {
    writeFileInRoot(
      packageRoot,
      `${target}/manifest.json`,
      JSON.stringify(
        {
          manifest_version: 3,
          name: "DX Command Center",
          version: "0.1.0",
          icons: {
            16: "static/dx.svg",
            48: "static/dx.svg",
            128: "static/dx.svg"
          },
          action: {
            default_icon: {
              16: "static/dx.svg",
              48: "static/dx.svg",
              128: "static/dx.svg"
            }
          },
          permissions: ["nativeMessaging"],
          background:
            target === "firefox"
              ? { scripts: ["js/background/firefox.js"] }
              : { service_worker: "js/background/chromium.js" },
          ...(target === "firefox"
            ? {
                browser_specific_settings: {
                  gecko: {
                    id: "dx-browser-command-center@dx.dev"
                  }
                }
              }
            : {})
        },
        null,
        2
      )
    );
    writeFileInRoot(
      packageRoot,
      `${target}/js/background/${target === "firefox" ? "firefox" : "chromium"}.js`,
      "export const background = true;\n"
    );
    writeFileInRoot(packageRoot, `${target}/js/ui/popup.js`, "export const popup = true;\n");
    writeFileInRoot(packageRoot, `${target}/static/dx.svg`, brandedIconSource);
  }
}

function writeNativeHostManifests(nativeHostBinaryPath: string) {
  return {
    chrome: writeNativeHostManifest("chrome", {
      name: "dev.dx.browser",
      description: "DX Browser native messaging host",
      path: nativeHostBinaryPath,
      type: "stdio",
      allowed_origins: ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/"]
    }),
    edge: writeNativeHostManifest("edge", {
      name: "dev.dx.browser",
      description: "DX Browser native messaging host",
      path: nativeHostBinaryPath,
      type: "stdio",
      allowed_origins: ["chrome-extension://bcdefghijklmnopabcdefghijklmnopa/"]
    }),
    firefox: writeNativeHostManifest("firefox", {
      name: "dev.dx.browser",
      description: "DX Browser native messaging host",
      path: nativeHostBinaryPath,
      type: "stdio",
      allowed_extensions: ["dx-browser-command-center@dx.dev"]
    })
  };
}

function writeNativeHostManifest(target: string, manifest: Record<string, unknown>): string {
  return writeWorkspaceFile(
    `native-host-manifests/${target}/dev.dx.browser.json`,
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

function writeExtensionIdCaptureReceipt(value: {
  chromeExtensionId: string;
  edgeExtensionId: string;
}): string {
  return writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/extension-id-capture-latest.json",
    `${JSON.stringify(
      {
        receipt: "dx.extension.browser.extension_id_capture",
        adapterId: "dx.browser.command-center",
        host: "browser",
        captures: [
          {
            target: "chrome",
            extensionId: value.chromeExtensionId
          },
          {
            target: "edge",
            extensionId: value.edgeExtensionId
          }
        ]
      },
      null,
      2
    )}\n`
  );
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function writeFileInRoot(root: string, relativePath: string, source: string): void {
  const targetPath = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
