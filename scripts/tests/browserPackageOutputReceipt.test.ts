import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { assertSourceInputReceipt } from "./sourceInputReceiptAssertions.ts";
import { writeBrowserPackageOutputReceipt } from "../write-browser-package-output-receipt.ts";

const browserSourceInputs = [
  "manifests/manifest.chromium.json",
  "manifests/manifest.edge.json",
  "manifests/manifest.firefox.json",
  "package.json",
  "src/background/chromium.ts",
  "src/background/common.ts",
  "src/background/firefox.ts",
  "src/background/messageSender.ts",
  "src/background/platform.ts",
  "src/runtime/commandPlans.ts",
  "src/runtime/messages.ts",
  "src/runtime/nativeHostTransport.ts",
  "src/runtime/protocol.ts",
  "src/ui/bootstrapCommandCenter.ts",
  "src/ui/commandDispatch.ts",
  "src/ui/commandStatus.ts",
  "src/ui/options.ts",
  "src/ui/popup.ts",
  "src/ui/renderCommandCenter.ts",
  "src/ui/sidebar.ts",
  "src/ui/sidepanel.ts",
  "static/dx.css",
  "static/dx.svg",
  "static/options.html",
  "static/popup.html",
  "static/sidebar.html",
  "static/sidepanel.html"
];
const sourceAdapterRoot = join(process.cwd(), "hosts", "browser", "dx-browser");
const packageRoot = mkdtempSync(join(tmpdir(), "dx-browser-package-output-"));
const receiptPath = join(packageRoot, "receipts", "package-output-latest.json");
const expectedPackageFiles = new Set<string>();
const brandedIconSource = "<svg><title>DX</title></svg>\n";
const brandedIconSha256 = createHash("sha256").update(brandedIconSource).digest("hex");

try {
  for (const target of ["chromium", "edge", "firefox"]) {
    writePackageFile(
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

    writePackageFile(
      `${target}/js/background/${target === "firefox" ? "firefox" : "chromium"}.js`,
      "export const background = true;\n"
    );
    writePackageFile(`${target}/js/ui/popup.js`, "export const popup = true;\n");
    writePackageFile(`${target}/js/ui/options.js`, "export const options = true;\n");
    writePackageFile(`${target}/static/dx.css`, "body { color: #111; }\n");
    writePackageFile(`${target}/static/dx.svg`, brandedIconSource);
  }

  writePackageFile("chromium/js/ui/sidepanel.js", "export const sidepanel = true;\n");
  writePackageFile("edge/js/ui/sidepanel.js", "export const sidepanel = true;\n");
  writePackageFile("firefox/js/ui/sidebar.js", "export const sidebar = true;\n");

  const receipt = writeBrowserPackageOutputReceipt({
    packageRoot,
    receiptPath,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run build:browser:j1"
  });

  assert.equal(receipt.receipt, "dx.extension.browser.package_output");
  assert.equal(receipt.adapterId, "dx.browser.command-center");
  assert.equal(receipt.host, "browser");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run build:browser:j1");
  assert.equal(receipt.receiptPath, receiptPath);
  assert.equal(receipt.package.root, packageRoot);
  assert.equal(receipt.package.format, "browser-extension-dist-layout");
  assert.deepEqual(receipt.inputs, browserSourceInputs);
  assertSourceInputReceipt(receipt, sourceAdapterRoot, browserSourceInputs);
  assert.deepEqual(
    receipt.package.files.map((file) => file.relativePath).sort(),
    [...expectedPackageFiles].sort()
  );
  assert.equal(receipt.targets.length, 3);
  assert.deepEqual(
    receipt.targets.map((target) => target.name),
    ["chromium", "edge", "firefox"]
  );
  assert.deepEqual(
    receipt.targets.map((target) => target.backgroundEntrypoint),
    [
      "chromium/js/background/chromium.js",
      "edge/js/background/chromium.js",
      "firefox/js/background/firefox.js"
    ]
  );
  assert.equal(
    receipt.targets.find((target) => target.name === "firefox")?.extensionId,
    "dx-browser-command-center@dx.dev"
  );
  assert.equal(receipt.targets.every((target) => target.manifestVersion === 3), true);
  assert.equal(receipt.targets.every((target) => target.permissionCount === 1), true);
  assert.deepEqual(
    receipt.targets.map((target) => target.brandedIcon),
    [
      {
        relativePath: "chromium/static/dx.svg",
        sha256: brandedIconSha256,
        manifestReferences: [
          "action.default_icon.128",
          "action.default_icon.16",
          "action.default_icon.48",
          "icons.128",
          "icons.16",
          "icons.48"
        ]
      },
      {
        relativePath: "edge/static/dx.svg",
        sha256: brandedIconSha256,
        manifestReferences: [
          "action.default_icon.128",
          "action.default_icon.16",
          "action.default_icon.48",
          "icons.128",
          "icons.16",
          "icons.48"
        ]
      },
      {
        relativePath: "firefox/static/dx.svg",
        sha256: brandedIconSha256,
        manifestReferences: [
          "action.default_icon.128",
          "action.default_icon.16",
          "action.default_icon.48",
          "icons.128",
          "icons.16",
          "icons.48"
        ]
      }
    ]
  );
  assert.deepEqual(receipt.releaseClaims, {
    loadedChromeProfileVerified: false,
    loadedEdgeProfileVerified: false,
    loadedFirefoxProfileVerified: false,
    nativeHostReleasePackageVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    storeDistributionVerified: false
  });

  assertPackageHashes(receipt.package.root, receipt.package.files, receipt.package.sha256);
  assert.equal(existsSync(receiptPath), true, "Browser package receipt should be written");
  assert.deepEqual(JSON.parse(readFileSync(receiptPath, "utf8")), receipt);
} finally {
  rmSync(packageRoot, { recursive: true, force: true });
}

assertMissingBackgroundEntrypointFails();
assertMissingBrandedIconFails();

console.log("Browser package output receipt verified");

function writePackageFile(relativePath: string, source: string): void {
  expectedPackageFiles.add(relativePath);
  writeFileInRoot(packageRoot, relativePath, source);
}

function assertMissingBrandedIconFails(): void {
  const malformedPackageRoot = mkdtempSync(join(tmpdir(), "dx-browser-missing-icon-"));

  try {
    for (const target of ["chromium", "edge", "firefox"]) {
      writeFileInRoot(
        malformedPackageRoot,
        `${target}/manifest.json`,
        JSON.stringify(
          {
            manifest_version: 3,
            name: "DX Command Center",
            version: "0.1.0",
            icons: {
              48: "static/dx.svg"
            },
            action: {
              default_icon: {
                48: "static/dx.svg"
              }
            },
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
        malformedPackageRoot,
        `${target}/js/background/${target === "firefox" ? "firefox" : "chromium"}.js`,
        "export const background = true;\n"
      );
      writeFileInRoot(malformedPackageRoot, `${target}/js/ui/popup.js`, "export const popup = true;\n");
    }

    assert.throws(
      () =>
        writeBrowserPackageOutputReceipt({
          packageRoot: malformedPackageRoot,
          receiptPath: join(malformedPackageRoot, "receipts", "package-output-latest.json")
        }),
      /Browser chromium branded icon asset is missing from the package output/
    );
  } finally {
    rmSync(malformedPackageRoot, { recursive: true, force: true });
  }
}

function writeFileInRoot(root: string, relativePath: string, source: string): void {
  const targetPath = join(root, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source);
}

function assertMissingBackgroundEntrypointFails(): void {
  const malformedPackageRoot = mkdtempSync(join(tmpdir(), "dx-browser-missing-background-"));

  try {
    for (const target of ["chromium", "edge", "firefox"]) {
      writeFileInRoot(
        malformedPackageRoot,
        `${target}/manifest.json`,
        JSON.stringify(
          {
            manifest_version: 3,
            name: "DX Command Center",
            version: "0.1.0",
            icons: {
              48: "static/dx.svg"
            },
            action: {
              default_icon: {
                48: "static/dx.svg"
              }
            },
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
      writeFileInRoot(malformedPackageRoot, `${target}/js/ui/popup.js`, "export const popup = true;\n");
      writeFileInRoot(malformedPackageRoot, `${target}/static/dx.svg`, brandedIconSource);

      if (target !== "firefox") {
        writeFileInRoot(
          malformedPackageRoot,
          `${target}/js/background/chromium.js`,
          "export const background = true;\n"
        );
      }
    }

    assert.throws(
      () =>
        writeBrowserPackageOutputReceipt({
          packageRoot: malformedPackageRoot,
          receiptPath: join(malformedPackageRoot, "receipts", "package-output-latest.json")
        }),
      /Browser firefox background entrypoint is missing from the package output/
    );
  } finally {
    rmSync(malformedPackageRoot, { recursive: true, force: true });
  }
}

function assertPackageHashes(
  packageRootPath: string,
  files: Array<{ relativePath: string; bytes: number; sha256: string }>,
  actualPackageHash: string
): void {
  const packageHash = createHash("sha256");

  for (const file of files) {
    const bytes = readFileSync(join(packageRootPath, file.relativePath));

    assert.equal(file.bytes, bytes.length);
    assert.equal(file.sha256, createHash("sha256").update(bytes).digest("hex"));
    packageHash.update(file.relativePath);
    packageHash.update("\0");
    packageHash.update(file.sha256);
    packageHash.update("\0");
    packageHash.update(String(file.bytes));
    packageHash.update("\n");
  }

  assert.equal(actualPackageHash, packageHash.digest("hex"));
}
