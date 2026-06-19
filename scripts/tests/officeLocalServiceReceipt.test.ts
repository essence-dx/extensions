import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { writeOfficeLocalServiceReceipt } from "../write-office-local-service-receipts.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-office-local-service-"));
const adapters = [
  {
    adapterId: "dx.excel.command-center",
    command: "dx.excel.show_status",
    host: "excel",
    officeApplication: "Excel",
    searchCommand: "dx.excel.search_assets",
    searchOperation: "dx.assets.search"
  },
  {
    adapterId: "dx.powerpoint.command-center",
    command: "dx.powerpoint.show_status",
    host: "powerpoint",
    officeApplication: "PowerPoint",
    searchCommand: "dx.powerpoint.search_media",
    searchOperation: "dx.media.search"
  },
  {
    adapterId: "dx.word.command-center",
    command: "dx.word.show_status",
    host: "word",
    officeApplication: "Word",
    searchCommand: "dx.word.search_assets",
    searchOperation: "dx.assets.search"
  }
] as const;

try {
  for (const adapter of adapters) {
    const sideloadedHostReceiptPath = writeWorkspaceFile(
      `.dx/receipts/extensions/${adapter.adapterId}/sideloaded-host-latest.json`,
      JSON.stringify(
        {
          receipt: "dx.extension.office_taskpane.sideloaded_host",
          adapterId: adapter.adapterId,
          host: adapter.host,
          office: {
            application: adapter.officeApplication,
            version: "16.0.17726.20160"
          },
          releaseClaims: {
            sideloadedHostVerified: true,
            localServiceVerified: false,
            signingVerified: false,
            appSourceApproved: false
          }
        },
        null,
        2
      )
    );
    const proofFilePath = writeWorkspaceFile(
      `office/${adapter.host}/local-service-proof.txt`,
      `${adapter.officeApplication} local-service request and response metadata.\n`
    );
    const proof = {
      host: adapter.host,
      officeApplication: adapter.officeApplication,
      officeVersion: "16.0.17726.20160",
      sideloadedHostReceiptPath,
      proofFilePath,
      localServiceTransport: "loopback",
      localServiceConnected: true,
      requests: [
        localServiceRequest(adapter.host, adapter.command, "dx.status"),
        localServiceRequest(adapter.host, adapter.searchCommand, adapter.searchOperation, "icons")
      ],
      responses: [
        localServiceResponse(adapter.command, "ok"),
        localServiceResponse(adapter.searchCommand, "ok")
      ],
      documentState: "loaded"
    };
    const receipt = writeOfficeLocalServiceReceipt(workspaceRoot, {
      generatedAt: "2026-06-07T00:00:00.000Z",
      verificationCommand: "npm run smoke:office-local-service:j1",
      proof
    });

    assert.equal(receipt.receipt, "dx.extension.office_taskpane.local_service");
    assert.equal(receipt.adapterId, adapter.adapterId);
    assert.equal(receipt.host, adapter.host);
    assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
    assert.equal(receipt.verificationCommand, "npm run smoke:office-local-service:j1");
    assert.equal(
      receipt.receiptPath,
      join(workspaceRoot, ".dx", "receipts", "extensions", adapter.adapterId, "local-service-latest.json")
    );
    assert.deepEqual(receipt.office, {
      application: adapter.officeApplication,
      version: "16.0.17726.20160"
    });
    assert.equal(receipt.sideloadedHost.receiptPath, sideloadedHostReceiptPath);
    assert.equal(receipt.sideloadedHost.receiptSha256, sha256(readFileSync(sideloadedHostReceiptPath)));
    assert.equal(receipt.localService.transport, "loopback");
    assert.equal(receipt.localService.connected, true);
    assert.deepEqual(
      receipt.localService.requests.map((request) => request.operation).sort(),
      ["dx.status", adapter.searchOperation].sort()
    );
    assert.equal(receipt.localService.requests.every((request) => request.protocol === "dx.office.local-service"), true);
    assert.equal(receipt.localService.requests.every((request) => request.context.hostDocumentState === "loaded"), true);
    assert.equal(receipt.localService.responses.every((response) => response.status === "ok"), true);
    assert.equal(receipt.manualProof.proofFilePath, proofFilePath);
    assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(proofFilePath)));
    assert.deepEqual(receipt.releaseClaims, {
      sideloadedHostVerified: true,
      localServiceVerified: true,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    });
    assert.equal(existsSync(receipt.receiptPath), true);
    assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  }

  const fixture = officeLocalServiceFixture("excel");
  assert.throws(
    () =>
      writeOfficeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          requests: [
            {
              ...fixture.requests[0],
              protocol: "bad.protocol"
            }
          ]
        }
      }),
    /must use the Office local-service protocol/
  );
  assert.throws(
    () =>
      writeOfficeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          sideloadedHostReceiptPath: writeWorkspaceFile(
            "office/excel/unloaded-host.json",
            JSON.stringify({
              receipt: "dx.extension.office_taskpane.sideloaded_host",
              adapterId: "dx.excel.command-center",
              host: "excel",
              office: { application: "Excel", version: "16.0.17726.20160" },
              releaseClaims: { sideloadedHostVerified: false }
            })
          )
        }
      }),
    /requires a verified sideloaded-host receipt/
  );
  assert.throws(
    () =>
      writeOfficeLocalServiceReceipt(workspaceRoot, {
        proof: {
          ...fixture,
          workbookName: "Budget.xlsx"
        }
      }),
    /privacy-sensitive Office local-service proof field/
  );

  const missingProofJsonResult = runWriterCli();
  assert.equal(missingProofJsonResult.status, 1);
  assert.match(
    missingProofJsonResult.stderr,
    /DX_OFFICE_LOCAL_SERVICE_PROOF_JSON must point to an Office local-service proof JSON file/
  );

  const relativeProofJsonResult = runWriterCli("relative-office-local-service-proof.json");
  assert.equal(relativeProofJsonResult.status, 1);
  assert.match(
    relativeProofJsonResult.stderr,
    /Office local-service proof JSON file must be an absolute path/
  );

  const nonexistentProofJsonResult = runWriterCli(join(workspaceRoot, "missing", "office-local-service-proof.json"));
  assert.equal(nonexistentProofJsonResult.status, 1);
  assert.match(
    nonexistentProofJsonResult.stderr,
    /Office local-service proof JSON file does not exist:/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Office local-service receipts verified");

function officeLocalServiceFixture(host: "excel" | "powerpoint" | "word") {
  const adapter = adapters.find((candidate) => candidate.host === host);

  assert.ok(adapter);

  const sideloadedHostReceiptPath = writeWorkspaceFile(
    `.dx/receipts/extensions/${adapter.adapterId}/fixture-sideloaded-host.json`,
    JSON.stringify({
      receipt: "dx.extension.office_taskpane.sideloaded_host",
      adapterId: adapter.adapterId,
      host: adapter.host,
      office: {
        application: adapter.officeApplication,
        version: "16.0.17726.20160"
      },
      releaseClaims: {
        sideloadedHostVerified: true
      }
    })
  );
  const proofFilePath = writeWorkspaceFile(`office/${adapter.host}/fixture-local-service-proof.txt`, "proof\n");

  return {
    host: adapter.host,
    officeApplication: adapter.officeApplication,
    officeVersion: "16.0.17726.20160",
    sideloadedHostReceiptPath,
    proofFilePath,
    localServiceTransport: "loopback",
    localServiceConnected: true,
    requests: [
      localServiceRequest(adapter.host, adapter.command, "dx.status"),
      localServiceRequest(adapter.host, adapter.searchCommand, adapter.searchOperation, "icons")
    ],
    responses: [
      localServiceResponse(adapter.command, "ok"),
      localServiceResponse(adapter.searchCommand, "ok")
    ],
    documentState: "loaded"
  };
}

function localServiceRequest(
  host: "excel" | "powerpoint" | "word",
  command: string,
  operation: "dx.status" | "dx.assets.search" | "dx.media.search",
  query?: string
) {
  return {
    protocol: "dx.office.local-service",
    schemaVersion: 1,
    host,
    command,
    operation,
    query,
    context: {
      hostDocumentState: "loaded"
    }
  };
}

function localServiceResponse(command: string, status: "ok" | "blocked") {
  return {
    command,
    status,
    payloadKind: "metadata-only"
  };
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

function runWriterCli(proofJsonPath?: string) {
  const env = { ...process.env };
  delete env.DX_OFFICE_LOCAL_SERVICE_PROOF_JSON;

  if (proofJsonPath !== undefined) {
    env.DX_OFFICE_LOCAL_SERVICE_PROOF_JSON = proofJsonPath;
  }

  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", resolve("scripts", "write-office-local-service-receipts.ts")],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env
    }
  );
}
