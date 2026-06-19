import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { writeOfficeSideloadedHostReceipt } from "../write-office-sideloaded-host-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-office-sideloaded-host-"));
const adapters = [
  {
    adapterId: "dx.excel.command-center",
    commandIds: ["dx.excel.show_status", "dx.excel.search_assets", "dx.excel.copy_receipts_path"],
    documentState: "loaded",
    host: "excel",
    officeApplication: "Excel",
    officeHost: "Workbook",
    route: "excel"
  },
  {
    adapterId: "dx.powerpoint.command-center",
    commandIds: [
      "dx.powerpoint.show_status",
      "dx.powerpoint.search_media",
      "dx.powerpoint.copy_receipts_path"
    ],
    documentState: "loaded",
    host: "powerpoint",
    officeApplication: "PowerPoint",
    officeHost: "Presentation",
    route: "powerpoint"
  },
  {
    adapterId: "dx.word.command-center",
    commandIds: ["dx.word.show_status", "dx.word.search_assets", "dx.word.copy_receipts_path"],
    documentState: "loaded",
    host: "word",
    officeApplication: "Word",
    officeHost: "Document",
    route: "word"
  }
] as const;

try {
  for (const adapter of adapters) {
    const manifestPath = writeWorkspaceFile(
      `office/${adapter.host}/manifest.xml`,
      officeManifest(adapter.officeHost, adapter.route, "ReadDocument")
    );
    const manifestSha256 = sha256(readFileSync(manifestPath));
    const packageFile = {
      relativePath: "manifest.xml",
      bytes: readFileSync(manifestPath).length,
      sha256: manifestSha256
    };
    const sourceRoot = join(workspaceRoot, "office-source");
    const sourceInputs = writeSourceInputs(adapter);
    const packageOutputReceiptPath = writeWorkspaceFile(
      `.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`,
      JSON.stringify(
        {
          receipt: "dx.extension.office_taskpane.package_output",
          adapterId: adapter.adapterId,
          host: adapter.host,
          manifest: {
            officeHost: adapter.officeHost,
            permission: "ReadDocument",
            taskpaneUrl: `https://localhost:3979/${adapter.route}/taskpane.html`
          },
          package: {
            root: dirname(manifestPath),
            fileCount: 1,
            sha256: hashPackageFiles([packageFile]),
            files: [packageFile]
          },
          sourceRoot,
          sourceInputs,
          sourceSha256: hashPackageFiles(sourceInputs),
          releaseClaims: {
            sideloadedHostVerified: false,
            localServiceVerified: false
          }
        },
        null,
        2
      )
    );
    const proofFilePath = writeWorkspaceFile(
      `office/${adapter.host}/sideload-proof.txt`,
      `${adapter.officeApplication} task pane loaded.\n`
    );
    const receipt = writeOfficeSideloadedHostReceipt(workspaceRoot, {
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run smoke:office-sideloaded-host:j1",
      proof: {
        host: adapter.host,
        officeApplication: adapter.officeApplication,
        officeVersion: "16.0.17726.20160",
        packageOutputReceiptPath,
        sideloadManifestPath: manifestPath,
        taskpaneUrl: `https://localhost:3979/${adapter.route}/taskpane.html`,
        proofFilePath,
        taskpaneLoaded: true,
        commandIdsVisible: [...adapter.commandIds],
        commandResults: adapter.commandIds.map((commandId) => ({
          commandId,
          status: commandId.endsWith(".copy_receipts_path") ? "clicked" : "proof-blocked"
        })),
        localServiceRequestsBlocked: true,
        documentState: adapter.documentState
      }
    });

    assert.equal(receipt.receipt, "dx.extension.office_taskpane.sideloaded_host");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(
      receipt.receiptPath,
      join(workspaceRoot, ".dx", "receipts", "extensions", adapter.adapterId, "sideloaded-host-latest.json")
    );
    assert.equal(receipt.office.application, adapter.officeApplication);
    assert.equal(receipt.office.version, "16.0.17726.20160");
    assert.equal(receipt.packageOutput.receiptPath, packageOutputReceiptPath);
    assert.equal(receipt.packageOutput.receiptSha256, sha256(readFileSync(packageOutputReceiptPath)));
    assert.equal(receipt.packageOutput.packageSha256, hashPackageFiles([packageFile]));
    assert.equal(receipt.sideload.manifestPath, manifestPath);
    assert.equal(receipt.sideload.manifestSha256, manifestSha256);
    assert.equal(receipt.sideload.taskpaneUrl, `https://localhost:3979/${adapter.route}/taskpane.html`);
    assert.equal(receipt.sideload.taskpaneLoaded, true);
    assert.equal(receipt.sideload.documentState, "loaded");
    assert.deepEqual(receipt.sideload.commandIdsVisible, [...adapter.commandIds].sort());
    assert.deepEqual(
      receipt.sideload.commandResults.map((result) => result.commandId).sort(),
      [...adapter.commandIds].sort()
    );
    assert.equal(receipt.sideload.localServiceRequestsBlocked, true);
    assert.equal(receipt.manualProof.proofFilePath, proofFilePath);
    assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(proofFilePath)));
    assert.deepEqual(receipt.releaseClaims, {
      sideloadedHostVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    });
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  }

  const fixture = officeProofFixture("excel");
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          taskpaneLoaded: false
        }
      }),
    /must verify a loaded task pane/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          localServiceRequestsBlocked: false
        }
      }),
    /must keep local-service requests blocked/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          host: "onenote"
        }
      }),
    /Unsupported Office sideloaded host/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          documentName: "Quarterly Plan"
        }
      }),
    /privacy-sensitive Office sideload proof field/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandIdsVisible: ["showStatus", "searchAssets", "copyReceiptsPath"],
          commandResults: [
            { commandId: "showStatus", status: "visible" },
            { commandId: "searchAssets", status: "proof-blocked" },
            { commandId: "copyReceiptsPath", status: "clicked" }
          ]
        }
      }),
    /unsupported Office sideloaded command id: showStatus/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandIdsVisible: ["dx.excel.show_status", "dx.excel.search_assets"]
        }
      }),
    /must include visible command metadata for dx\.excel\.copy_receipts_path/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandResults: [
            { commandId: "dx.excel.show_status", status: "visible" },
            { commandId: "dx.excel.search_assets", status: "proof-blocked" },
            { commandId: "dx.excel.export_secret", status: "proof-blocked" }
          ]
        }
      }),
    /unsupported Office sideloaded command id: dx\.excel\.export_secret/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandResults: [
            { commandId: "dx.excel.show_status", status: "visible" },
            { commandId: "dx.excel.search_assets", status: "proof-blocked" },
            { commandId: "dx.excel.copy_receipts_path", status: "clicked" },
            { commandId: "dx.excel.copy_receipts_path", status: "visible" }
          ]
        }
      }),
    /duplicates command result metadata: dx\.excel\.copy_receipts_path/
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          commandResults: [
            { commandId: "dx.excel.show_status", status: "visible" },
            { commandId: "dx.excel.search_assets", status: "proof-blocked", selectionText: "Quarterly numbers" },
            { commandId: "dx.excel.copy_receipts_path", status: "clicked" }
          ]
        }
      }),
    /privacy-sensitive Office sideload proof field: selectionText/
  );

  const broadManifestPath = writeWorkspaceFile(
    "office/excel/broad-manifest.xml",
    officeManifest("Workbook", "excel", "ReadWriteDocument")
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          sideloadManifestPath: broadManifestPath
        }
      }),
    /must keep ReadDocument permission/
  );

  const stalePackageReceiptPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.excel.command-center/stale-package-output.json",
    JSON.stringify({
      receipt: "dx.extension.office_taskpane.package_output",
      adapterId: "dx.excel.command-center",
      host: "excel",
      manifest: {
        officeHost: "Workbook",
        permission: "ReadDocument",
        taskpaneUrl: "https://localhost:3979/excel/taskpane.html"
      },
      package: {
        files: [{ relativePath: "manifest.xml", bytes: 1, sha256: "0".repeat(64) }]
      }
    })
  );
  assert.throws(
    () =>
      writeOfficeSideloadedHostReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          packageOutputReceiptPath: stalePackageReceiptPath
        }
      }),
    /sideload manifest hash must match package-output receipt/
  );

  const missingProofJsonResult = runWriterCli();
  assert.equal(missingProofJsonResult.status, 1);
  assert.match(
    missingProofJsonResult.stderr,
    /DX_OFFICE_SIDELOADED_HOST_PROOF_JSON must point to an Office sideload proof JSON file/
  );

  const relativeProofJsonResult = runWriterCli("relative-office-sideloaded-host-proof.json");
  assert.equal(relativeProofJsonResult.status, 1);
  assert.match(
    relativeProofJsonResult.stderr,
    /Office sideloaded proof JSON file must be an absolute path/
  );

  const nonexistentProofJsonResult = runWriterCli(join(workspaceRoot, "missing", "office-sideloaded-proof.json"));
  assert.equal(nonexistentProofJsonResult.status, 1);
  assert.match(
    nonexistentProofJsonResult.stderr,
    /Office sideloaded proof JSON file does not exist:/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Office sideloaded-host receipts verified");

function officeProofFixture(host: "excel" | "powerpoint" | "word") {
  const adapter = adapters.find((candidate) => candidate.host === host);
  assert.ok(adapter);

  const manifestPath = join(workspaceRoot, "office", adapter.host, "manifest.xml");
  const packageOutputReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapter.adapterId,
    "package-output-latest.json"
  );
  const proofFilePath = join(workspaceRoot, "office", adapter.host, "sideload-proof.txt");

  return {
    host: adapter.host,
    officeApplication: adapter.officeApplication,
    officeVersion: "16.0.17726.20160",
    packageOutputReceiptPath,
    sideloadManifestPath: manifestPath,
    taskpaneUrl: `https://localhost:3979/${adapter.route}/taskpane.html`,
    proofFilePath,
    taskpaneLoaded: true,
    commandIdsVisible: [...adapter.commandIds],
    commandResults: adapter.commandIds.map((commandId) => ({
      commandId,
      status: commandId.endsWith(".copy_receipts_path") ? "clicked" : "proof-blocked"
    })),
    localServiceRequestsBlocked: true,
    documentState: "loaded" as const
  };
}

function officeManifest(officeHost: string, route: string, permission: string): string {
  return [
    "<OfficeApp>",
    `<Hosts><Host Name="${officeHost}"/></Hosts>`,
    `<Permissions>${permission}</Permissions>`,
    `<SourceLocation DefaultValue="https://localhost:3979/${route}/taskpane.html"/>`,
    "</OfficeApp>",
    ""
  ].join("\n");
}

function writeSourceInputs(adapter: (typeof adapters)[number]) {
  return [
    writeSourceInput(
      `office-source/${sourceFolder(adapter)}/manifest.xml`,
      officeManifest(adapter.officeHost, adapter.route, "ReadDocument")
    ),
    writeSourceInput(
      `office-source/${sourceFolder(adapter)}/src/commandPlans.ts`,
      `export const commandIds = ${JSON.stringify(adapter.commandIds)};\n`
    ),
    writeSourceInput(
      `office-source/${sourceFolder(adapter)}/src/messages.ts`,
      `export const host = ${JSON.stringify(adapter.host)};\n`
    ),
    writeSourceInput(
      `office-source/${sourceFolder(adapter)}/src/taskpane.ts`,
      `export const route = ${JSON.stringify(adapter.route)};\n`
    ),
    writeSourceInput(
      `office-source/${sourceFolder(adapter)}/static/taskpane.html`,
      `<main>${adapter.officeApplication} taskpane</main>\n`
    ),
    writeSourceInput(
      "office-source/shared/localServiceBoundary.ts",
      "export const protocol = 'dx.office.local-service';\n"
    )
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function writeSourceInput(workspaceRelativePath: string, source: string) {
  const absolutePath = writeWorkspaceFile(workspaceRelativePath, source);
  const bytes = readFileSync(absolutePath);

  return {
    relativePath: workspaceRelativePath.replace("office-source/", ""),
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function sourceFolder(adapter: (typeof adapters)[number]): string {
  return `dx-${adapter.host}`;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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

function runWriterCli(proofJsonPath?: string) {
  const env = { ...process.env };
  delete env.DX_OFFICE_SIDELOADED_HOST_PROOF_JSON;

  if (proofJsonPath !== undefined) {
    env.DX_OFFICE_SIDELOADED_HOST_PROOF_JSON = proofJsonPath;
  }

  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", resolve("scripts", "write-office-sideloaded-host-receipts.ts")],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env
    }
  );
}
