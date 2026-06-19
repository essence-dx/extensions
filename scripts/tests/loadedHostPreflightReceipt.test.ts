import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeLoadedHostPreflightReceipts } from "../write-loaded-host-preflight-receipts.ts";
import { writeReleasePackageChecksumReceipt } from "../write-release-package-checksum-receipts.ts";
import { writeAffinityContentPackageReceipt as writeProductionAffinityContentPackageReceipt } from "../write-affinity-content-package-receipt.ts";
import { hashSourceInputs, readSourceInputProofs } from "../lib/source-input-proof.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-loaded-host-preflight-"));

try {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.official_extensions"
manifest_version = 1

[[extensions]]
id = "dx.figma.command-center"
host = "figma"
kind = "plugin"
manifest = "hosts/figma/dx-figma/dx.extension.toml"
package = "hosts/figma/dx-figma"
commands = ["dx.figma.open"]
receipts = [".dx/receipts/extensions/dx.figma.command-center/readiness-latest.json"]

[[extensions]]
id = "dx.sketch.command-center"
host = "sketch"
kind = "plugin"
manifest = "hosts/sketch/dx-sketch/dx.extension.toml"
package = "hosts/sketch/dx-sketch"
commands = ["dx.sketch.open"]
receipts = [".dx/receipts/extensions/dx.sketch.command-center/readiness-latest.json"]

[[extensions]]
id = "dx.affinity-content.bridge"
host = "affinity"
kind = "content"
manifest = "hosts/affinity/dx-affinity-content/dx.extension.toml"
package = "hosts/affinity/dx-affinity-content"
commands = ["dx.affinity.import"]
receipts = [".dx/receipts/extensions/dx.affinity-content.bridge/readiness-latest.json"]
`
  );
  writeWorkspaceFile(
    "registry/extension-readiness.toml",
    `
schema = "dx.extension_readiness"
manifest_version = 1

[[extensions]]
id = "dx.figma.command-center"
stage = "source-level"
manifest = "hosts/figma/dx-figma/dx.extension.toml"
source_guard = "test:figma-adapter"
latest_readiness_receipt = ".dx/receipts/extensions/dx.figma.command-center/readiness-latest.json"
next_proof = "Run a loaded Figma desktop plugin smoke."
blocked_by = ["loaded Figma desktop receipt", "package proof", "checksum receipt", "Community review proof"]

[[extensions]]
id = "dx.sketch.command-center"
stage = "source-level"
manifest = "hosts/sketch/dx-sketch/dx.extension.toml"
source_guard = "test:sketch-adapter"
latest_readiness_receipt = ".dx/receipts/extensions/dx.sketch.command-center/readiness-latest.json"
next_proof = "Load the Sketch plugin or run sketchtool."
blocked_by = ["loaded Sketch plugin receipt", "Plugin Directory review proof"]

[[extensions]]
id = "dx.affinity-content.bridge"
stage = "source-level"
manifest = "hosts/affinity/dx-affinity-content/dx.extension.toml"
source_guard = "test:affinity-content-addon-adapter"
latest_readiness_receipt = ".dx/receipts/extensions/dx.affinity-content.bridge/readiness-latest.json"
next_proof = "Import DX content assets manually into Affinity apps."
blocked_by = ["loaded Affinity app smoke", "real content package proof", "manual Affinity import receipt", "Affinity distribution proof"]
`
  );
  writeWorkspaceFile("hosts/figma/dx-figma/dx.extension.toml", `[extension]\nid = "dx.figma.command-center"\n`);
  writeWorkspaceFile("hosts/sketch/dx-sketch/dx.extension.toml", `[extension]\nid = "dx.sketch.command-center"\n`);
  writeWorkspaceFile("hosts/affinity/dx-affinity-content/dx.extension.toml", `[extension]\nid = "dx.affinity-content.bridge"\n`);

  writeReleaseEvidenceGates();
  const figmaPackageOutput = writePackageOutputReceipt({
    adapterId: "dx.figma.command-center",
    host: "figma",
    payloadKey: "package",
    root: "hosts/figma/dx-figma",
    files: {
      "main.js": "export const figmaPlugin = true;\n",
      "manifest.json": "{\"name\":\"DX\"}\n"
    },
    releaseClaims: {
      loadedHostVerified: false,
      localServiceVerified: false,
      distributionVerified: false
    }
  });
  const figmaReleaseArtifactPath = writeWorkspaceFile(
    "release/figma/dx-figma-command-center.zip",
    "Figma release artifact\n"
  );
  writeReleasePackageChecksumReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:release-package-checksum:j1",
    proof: {
      adapterId: "dx.figma.command-center",
      host: "figma",
      packageOutputReceiptPath: figmaPackageOutput.receiptPath,
      packageOutputSha256: figmaPackageOutput.packageSha256,
      releaseArtifactPath: figmaReleaseArtifactPath,
      releaseArtifactSha256: createHash("sha256").update(readFileSync(figmaReleaseArtifactPath)).digest("hex"),
      releaseArtifactKind: "zip",
      artifactCreatedFromPackageOutput: true
    }
  });
  writePackageOutputReceipt({
    adapterId: "dx.sketch.command-center",
    host: "sketch",
    payloadKey: "bundle",
    root: "hosts/sketch/dx-sketch/dx-sketch.sketchplugin",
    files: {
      "Contents/Sketch/index.js": "export const sketchPlugin = true;\n",
      "Contents/Sketch/manifest.json": "{\"name\":\"DX\"}\n"
    },
    releaseClaims: {
      loadedHostVerified: false,
      sketchtoolVerified: false,
      distributionVerified: false
    }
  });
  writeAffinityContentPackageReceipt();

  const result = writeLoadedHostPreflightReceipts(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run preflight:loaded-host-targets:j1"
  });

  assert.deepEqual(
    result.written.map((receipt) => receipt.adapterId),
    ["dx.affinity-content.bridge", "dx.figma.command-center", "dx.sketch.command-center"]
  );

  const figmaReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    "dx.figma.command-center",
    "loaded-host-preflight-latest.json"
  );
  const figmaReceipt = JSON.parse(readFileSync(figmaReceiptPath, "utf8"));
  assert.equal(figmaReceipt.receipt, "dx.extension.loaded_host_preflight");
  assert.equal(figmaReceipt.adapterId, "dx.figma.command-center");
  assert.equal(figmaReceipt.host, "figma");
  assert.equal(figmaReceipt.readiness.stage, "source-level");
  assert.deepEqual(figmaReceipt.readiness.blockedBy, [
    "loaded Figma desktop receipt",
    "Community review proof"
  ]);
  assert.equal(figmaReceipt.packageOutput.payloadKind, "package");
  assert.equal(figmaReceipt.packageOutput.fileCount, 2);
  assert.equal(figmaReceipt.packageOutput.filesVerified, 2);
  assert.equal(figmaReceipt.releaseClaims.allFalse, true);
  assert.deepEqual(figmaReceipt.preflightClaims, {
    hostExecuted: false,
    loadedHostVerified: false,
    releaseReady: false,
    marketplaceOrStoreVerified: false
  });
  assert.equal(existsSync(result.written[0].path), true);
  assertAffinityContentPreflight();
  assertScopedCliWritesOnlyRequestedAdapter(figmaReceiptPath);

  writeWorkspaceFile("hosts/figma/dx-figma/main.js", "export const stale = true;\n");
  assert.throws(
    () =>
      writeLoadedHostPreflightReceipts(workspaceRoot, {
        adapterIds: ["dx.figma.command-center"],
        verificationCommand: "npm run preflight:loaded-host-targets:j1"
      }),
    /package output file hash changed for dx\.figma\.command-center: main\.js/
  );

  writePackageOutputReceipt({
    adapterId: "dx.figma.command-center",
    host: "figma",
    payloadKey: "package",
    root: "hosts/figma/dx-figma",
    files: {
      "main.js": "export const figmaPlugin = true;\n"
    },
    releaseClaims: {
      loadedHostVerified: true
    }
  });
  assert.throws(
    () =>
      writeLoadedHostPreflightReceipts(workspaceRoot, {
        adapterIds: ["dx.figma.command-center"],
        verificationCommand: "npm run preflight:loaded-host-targets:j1"
      }),
    /package output receipt for dx\.figma\.command-center must not contain true release claims/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("loaded-host preflight receipts verified");

function assertAffinityContentPreflight(): void {
  const affinityReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    "dx.affinity-content.bridge",
    "loaded-host-preflight-latest.json"
  );
  const affinityReceipt = JSON.parse(readFileSync(affinityReceiptPath, "utf8"));

  assert.equal(affinityReceipt.receipt, "dx.extension.loaded_host_preflight");
  assert.equal(affinityReceipt.adapterId, "dx.affinity-content.bridge");
  assert.equal(affinityReceipt.host, "affinity");
  assert.equal(
    affinityReceipt.packageOutputReceiptPath,
    join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      "dx.affinity-content.bridge",
      "content-package-latest.json"
    )
  );
  assert.deepEqual(affinityReceipt.readiness.blockedBy, [
    "loaded Affinity app smoke",
    "manual Affinity import receipt",
    "Affinity distribution proof"
  ]);
  assert.equal(affinityReceipt.preflightClaims.hostExecuted, false);
  assert.equal(affinityReceipt.preflightClaims.loadedHostVerified, false);
}

function assertScopedCliWritesOnlyRequestedAdapter(figmaReceiptPath: string): void {
  const sketchReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    "dx.sketch.command-center",
    "loaded-host-preflight-latest.json"
  );
  const affinityReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    "dx.affinity-content.bridge",
    "loaded-host-preflight-latest.json"
  );

  rmSync(figmaReceiptPath, { force: true });
  rmSync(sketchReceiptPath, { force: true });
  rmSync(affinityReceiptPath, { force: true });
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      join(import.meta.dirname, "..", "write-loaded-host-preflight-receipts.ts"),
      "--adapter-id",
      "dx.figma.command-center",
      "--verification-command",
      "npm run scoped:figma-preflight"
    ],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      windowsHide: true
    }
  );

  assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
  assert.equal(existsSync(figmaReceiptPath), true);
  assert.equal(JSON.parse(readFileSync(figmaReceiptPath, "utf8")).verificationCommand, "npm run scoped:figma-preflight");
  assert.equal(existsSync(sketchReceiptPath), false);
  assert.equal(existsSync(affinityReceiptPath), false);
}

function writeAffinityContentPackageReceipt(): { receiptPath: string; packageSha256: string } {
  const adapterRoot = join(workspaceRoot, "hosts", "affinity", "dx-affinity-content");
  const packageRoot = join(workspaceRoot, "hosts", "affinity", "dx-affinity-content", "dist", "content-package");
  writePackageFile(adapterRoot, "src/contentPlans.ts", "export const contentPlans = [];\n");
  writePackageFile(adapterRoot, "src/importGuide.ts", "export const importGuide = 'Import DX content.';\n");
  writePackageFile(
    adapterRoot,
    "affinity-content-manifest.json",
    `${JSON.stringify(
      {
        name: "DX Affinity Content Bridge",
        supportedHosts: ["Affinity Photo 2"],
        supportedContentTypes: [
          {
            type: "assets",
            extensions: [".afassets"]
          }
        ]
      },
      null,
      2
    )}\n`
  );
  writePackageFile(
    packageRoot,
    "affinity-content-manifest.json",
    readFileSync(join(adapterRoot, "affinity-content-manifest.json"), "utf8")
  );
  writePackageFile(packageRoot, "assets/dx-icons.afassets", "affinity assets\n");
  const receipt = writeProductionAffinityContentPackageReceipt({
    adapterRoot,
    packageRoot,
    receiptPath: join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      "dx.affinity-content.bridge",
      "content-package-latest.json"
    ),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:affinity-content:j1"
  });

  return {
    receiptPath: receipt.receiptPath,
    packageSha256: receipt.package.sha256
  };
}

function writePackageSourceProof(adapterId: string): {
  sourceRoot: string;
  sourceInputs: ReturnType<typeof readSourceInputProofs>;
  sourceSha256: string;
} | undefined {
  if (adapterId === "dx.figma.command-center") {
    const sourceRoot = join(workspaceRoot, "hosts", "figma", "dx-figma");
    const inputPaths = [
      "manifest.json",
      "src/commandPlans.ts",
      "src/main.ts",
      "src/messages.ts",
      "ui.html"
    ];

    writePackageFile(sourceRoot, "manifest.json", "{\"name\":\"DX\"}\n");
    writePackageFile(sourceRoot, "ui.html", "<main>DX</main>\n");
    writePackageFile(sourceRoot, "src/commandPlans.ts", "export const commandPlans = [];\n");
    writePackageFile(sourceRoot, "src/main.ts", "export const figmaMain = true;\n");
    writePackageFile(sourceRoot, "src/messages.ts", "export const messages = {};\n");

    const sourceInputs = readSourceInputProofs(sourceRoot, inputPaths);

    return {
      sourceRoot,
      sourceInputs,
      sourceSha256: hashSourceInputs(sourceInputs)
    };
  }

  if (adapterId === "dx.sketch.command-center") {
    const sourceRoot = join(workspaceRoot, "hosts", "sketch", "dx-sketch");
    const inputPaths = ["manifest.json", "src/commandPlans.ts", "src/index.ts", "src/messages.ts"];

    writePackageFile(sourceRoot, "manifest.json", "{\"name\":\"DX\"}\n");
    writePackageFile(sourceRoot, "src/commandPlans.ts", "export const commandPlans = [];\n");
    writePackageFile(sourceRoot, "src/index.ts", "export const sketchMain = true;\n");
    writePackageFile(sourceRoot, "src/messages.ts", "export const messages = {};\n");

    const sourceInputs = readSourceInputProofs(sourceRoot, inputPaths);

    return {
      sourceRoot,
      sourceInputs,
      sourceSha256: hashSourceInputs(sourceInputs)
    };
  }

  return undefined;
}

function writePackageOutputReceipt(options: {
  adapterId: string;
  host: string;
  payloadKey: "package" | "bundle";
  root: string;
  files: Record<string, string>;
  releaseClaims: Record<string, boolean>;
}): { receiptPath: string; packageSha256: string } {
  const files = Object.entries(options.files)
    .map(([relativePath, source]) => {
      writeWorkspaceFile(join(options.root, relativePath), source);
      const bytes = Buffer.from(source);
      return {
        relativePath: relativePath.replaceAll("\\", "/"),
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex")
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const payload = {
    root: join(workspaceRoot, options.root),
    fileCount: files.length,
    sha256: hashPackageFiles(files),
    files
  };
  const receiptType = ["canva", "figma"].includes(options.host)
    ? "dx.extension.figma_canva.package_output"
    : `dx.extension.${options.host}.package_output`;
  const sourceProof = writePackageSourceProof(options.adapterId);
  const receipt = {
    receipt: receiptType,
    adapterId: options.adapterId,
    host: options.host,
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: `npm run build:${options.host}:j1`,
    receiptPath: join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      options.adapterId,
      "package-output-latest.json"
    ),
    [options.payloadKey]: payload,
    ...(sourceProof ?? {}),
    releaseClaims: options.releaseClaims
  };

  writeWorkspaceFile(
    join(".dx", "receipts", "extensions", options.adapterId, "package-output-latest.json"),
    `${JSON.stringify(receipt, null, 2)}\n`
  );

  return {
    receiptPath: receipt.receiptPath,
    packageSha256: payload.sha256
  };
}

function writePackageFile(root: string, relativePath: string, source: string): string {
  const absolutePath = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}

function writeReleaseEvidenceGates(): void {
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "dx.figma.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "community_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.figma.command-center/loaded-host-latest.json", "package_output=.dx/receipts/extensions/dx.figma.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.figma.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.figma.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.figma.command-center/community-review-latest.json", "community_review=.dx/receipts/extensions/dx.figma.command-center/community-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.figma.command-center/loaded-host-latest.json", ".dx/receipts/extensions/dx.figma.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.figma.command-center/signing-latest.json", ".dx/receipts/extensions/dx.figma.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.figma.command-center/community-review-latest.json"]
next_release_proof = "Run a loaded Figma desktop plugin smoke."
blocked_by = ["loaded Figma receipt", "Community review proof"]

[[extensions]]
id = "dx.sketch.command-center"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.sketch.command-center/loaded-host-latest.json", "package_output=.dx/receipts/extensions/dx.sketch.command-center/package-output-latest.json", "signing=.dx/receipts/extensions/dx.sketch.command-center/signing-latest.json", "checksum=.dx/receipts/extensions/dx.sketch.command-center/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.sketch.command-center/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.sketch.command-center/loaded-host-latest.json", ".dx/receipts/extensions/dx.sketch.command-center/package-output-latest.json", ".dx/receipts/extensions/dx.sketch.command-center/signing-latest.json", ".dx/receipts/extensions/dx.sketch.command-center/checksum-latest.json", ".dx/receipts/extensions/dx.sketch.command-center/distribution-latest.json"]
next_release_proof = "Load the Sketch plugin or run sketchtool."
blocked_by = ["loaded Sketch plugin receipt", "Plugin Directory review proof"]

[[extensions]]
id = "dx.affinity-content.bridge"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "manual_import", "content_package", "photoshop_filter_plugin"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/dx.affinity-content.bridge/loaded-app-latest.json", "manual_import=.dx/receipts/extensions/dx.affinity-content.bridge/manual-import-latest.json", "photoshop_filter_plugin=.dx/receipts/extensions/dx.affinity-content.bridge/photoshop-filter-plugin-latest.json", "package_output=.dx/receipts/extensions/dx.affinity-content.bridge/content-package-latest.json", "content_package=.dx/receipts/extensions/dx.affinity-content.bridge/content-package-latest.json", "signing=.dx/receipts/extensions/dx.affinity-content.bridge/signing-latest.json", "checksum=.dx/receipts/extensions/dx.affinity-content.bridge/checksum-latest.json", "distribution_review=.dx/receipts/extensions/dx.affinity-content.bridge/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/dx.affinity-content.bridge/loaded-app-latest.json", ".dx/receipts/extensions/dx.affinity-content.bridge/manual-import-latest.json", ".dx/receipts/extensions/dx.affinity-content.bridge/photoshop-filter-plugin-latest.json", ".dx/receipts/extensions/dx.affinity-content.bridge/content-package-latest.json", ".dx/receipts/extensions/dx.affinity-content.bridge/signing-latest.json", ".dx/receipts/extensions/dx.affinity-content.bridge/checksum-latest.json", ".dx/receipts/extensions/dx.affinity-content.bridge/distribution-latest.json"]
next_release_proof = "Import DX content assets manually into Affinity apps and capture Photoshop-compatible filter plugin proof."
blocked_by = ["loaded Affinity app smoke", "manual Affinity import receipt", "Photoshop-compatible filter plugin proof", "real content package proof", "Affinity distribution proof"]
`
  );
}

function hashPackageFiles(files: Array<{ relativePath: string; bytes: number; sha256: string }>): string {
  const hash = createHash("sha256");

  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
    hash.update(String(file.bytes));
    hash.update("\n");
  }

  return hash.digest("hex");
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);

  return absolutePath;
}
