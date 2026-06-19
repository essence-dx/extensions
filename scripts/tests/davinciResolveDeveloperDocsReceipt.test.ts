import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { classifySpecialProofWeakness } from "../lib/release-evidence-special-proof-classifier.ts";
import { writeDavinciResolveDeveloperDocsReceipt } from "../write-davinci-resolve-developer-docs-receipt.ts";
import { writeDavinciResolvePackageOutputReceipt } from "../write-davinci-resolve-package-output-receipt.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-davinci-developer-docs-"));
const adapterId = "dx.davinci-resolve.command-center";
const adapterRoot = join(workspaceRoot, "hosts", "blackmagic", "dx-davinci-resolve");
const docsRoot = join(workspaceRoot, "proof", "davinci-developer-docs");
const docsFiles = [
  join(docsRoot, "README.txt"),
  join(docsRoot, "Scripting", "WorkflowIntegration.txt")
];

try {
  writeWorkspaceFixtures();
  const packageOutputReceipt = writeDavinciResolvePackageOutputReceipt({
    adapterRoot,
    packageRoot: adapterRoot,
    receiptPath: join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "package-output-latest.json"),
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run package:davinci-resolve:j1"
  });
  const proofFilePath = writeFile(
    join(workspaceRoot, "proof", "davinci-developer-docs-proof.txt"),
    "DaVinci Resolve Developer documentation version was captured from the installed docs.\n"
  );

  const receipt = writeDavinciResolveDeveloperDocsReceipt(workspaceRoot, {
    generatedAt: "2026-06-07T00:00:00.000Z",
    verificationCommand: "npm run smoke:davinci-resolve-developer-docs:j1",
    proof: {
      packageOutputReceiptPath: packageOutputReceipt.receiptPath,
      proofFilePath,
      docsRoot,
      docsFiles,
      docsSource: "installed-developer-documentation",
      resolveVersion: "19.1.4",
      developerDocsVersion: "DaVinci Resolve 19 Developer Documentation"
    }
  });

  assert.equal(receipt.receipt, "dx.extension.davinci_resolve.developer_docs");
  assert.equal(receipt.adapterId, adapterId);
  assert.equal(receipt.host, "davinci-resolve");
  assert.equal(receipt.generatedAt, "2026-06-07T00:00:00.000Z");
  assert.equal(receipt.verificationCommand, "npm run smoke:davinci-resolve-developer-docs:j1");
  assert.equal(
    receipt.receiptPath,
    join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "developer-docs-latest.json")
  );
  assert.equal(receipt.packageOutput.receiptPath, packageOutputReceipt.receiptPath);
  assert.equal(receipt.packageOutput.packageSha256, packageOutputReceipt.package.sha256);
  assert.equal(receipt.documentation.docsRoot, docsRoot);
  assert.equal(receipt.documentation.docsSource, "installed-developer-documentation");
  assert.equal(receipt.documentation.resolveVersion, "19.1.4");
  assert.equal(receipt.documentation.developerDocsVersion, "DaVinci Resolve 19 Developer Documentation");
  assert.equal(receipt.documentation.fileCount, 2);
  assert.equal(receipt.documentation.metadataOnly, true);
  assert.deepEqual(
    receipt.documentation.files.map((file) => file.relativePath),
    ["README.txt", "Scripting/WorkflowIntegration.txt"]
  );
  assert.equal(receipt.manualProof.proofFileSha256, sha256(readFileSync(proofFilePath)));
  assert.deepEqual(receipt.releaseClaims, {
    packageOutputVerified: true,
    developerDocsVersionVerified: true,
    loadedResolveVerified: false,
    workflowIntegrationVerified: false,
    localServiceVerified: false,
    signingVerified: false,
    releaseChecksumVerified: false,
    distributionVerified: false
  });
  assert.equal(existsSync(receipt.receiptPath), true);
  assert.deepEqual(JSON.parse(readFileSync(receipt.receiptPath, "utf8")), receipt);
  assert.equal(classifySpecialProofWeakness("developer_docs", receipt), undefined);

  writeFileSync(docsFiles[0], "DaVinci Resolve Developer Documentation changed after capture.\n");
  assert.match(
    classifySpecialProofWeakness("developer_docs", receipt) ?? "",
    /developer-docs documentation file size changed|developer-docs documentation file hash changed/
  );

  writeFileSync(docsFiles[0], "DaVinci Resolve Developer Documentation 19.1.4\n");
  writeFileSync(proofFilePath, "DaVinci Resolve Developer documentation proof changed after capture.\n");
  assert.match(
    classifySpecialProofWeakness("developer_docs", receipt) ?? "",
    /developer-docs manual proof file hash changed/
  );

  writeFileSync(
    proofFilePath,
    "DaVinci Resolve Developer documentation version was captured from the installed docs.\n"
  );
  const packageOutputReceiptSource = readFileSync(packageOutputReceipt.receiptPath, "utf8");
  writeFileSync(packageOutputReceipt.receiptPath, "{}\n");
  assert.match(
    classifySpecialProofWeakness("developer_docs", receipt) ?? "",
    /developer-docs linked package-output receipt hash changed/
  );

  writeFileSync(packageOutputReceipt.receiptPath, packageOutputReceiptSource);

  assert.throws(
    () =>
      writeDavinciResolveDeveloperDocsReceipt(workspaceRoot, {
        proof: {
          packageOutputReceiptPath: packageOutputReceipt.receiptPath,
          proofFilePath,
          docsRoot,
          docsFiles: [],
          docsSource: "installed-developer-documentation",
          resolveVersion: "19.1.4",
          developerDocsVersion: "DaVinci Resolve 19 Developer Documentation"
        }
      }),
    /requires at least one documentation file/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("DaVinci Resolve developer documentation receipt verified");

function writeWorkspaceFixtures(): void {
  writeWorkspaceFile(
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
name = "DX DaVinci Resolve Command Center"
path = "hosts/blackmagic/dx-davinci-resolve"
manifest = "hosts/blackmagic/dx-davinci-resolve/dx.extension.toml"
status = "experimental"
professional_targets = ["blackmagic.davinci-resolve.scripting"]
`
  );
  writeWorkspaceFile(
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

[[extensions]]
id = "${adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "workflow_integration", "developer_docs"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapterId}/package-output-latest.json", "workflow_integration=.dx/receipts/extensions/${adapterId}/workflow-integration-latest.json", "developer_docs=.dx/receipts/extensions/${adapterId}/developer-docs-latest.json", "signing=.dx/receipts/extensions/${adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapterId}/distribution-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapterId}/workflow-integration-latest.json", ".dx/receipts/extensions/${adapterId}/developer-docs-latest.json", ".dx/receipts/extensions/${adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapterId}/distribution-latest.json"]
next_release_proof = "Capture installed DaVinci Resolve Developer documentation version."
blocked_by = ["Developer documentation version capture"]
`
  );
  writeWorkspaceFile("hosts/blackmagic/dx-davinci-resolve/dx.extension.toml", "[extension]\nid = \"dx.davinci-resolve.command-center\"\n");
  writeWorkspaceFile(
    "hosts/blackmagic/dx-davinci-resolve/command-plans.json",
    JSON.stringify(
      {
        schema: "dx.davinci_resolve.command_plans",
        commands: [
          { id: "status", mutatesResolveProject: false },
          { id: "searchMedia", mutatesResolveProject: false },
          { id: "showReceipts", mutatesResolveProject: false }
        ]
      },
      null,
      2
    )
  );
  writeWorkspaceFile("hosts/blackmagic/dx-davinci-resolve/scripts/dx_command_center.lua", "return {}\n");
  writeWorkspaceFile("hosts/blackmagic/dx-davinci-resolve/scripts/dx_command_center.py", "COMMANDS = []\n");
  writeFile(docsFiles[0], "DaVinci Resolve Developer Documentation 19.1.4\n");
  writeFile(docsFiles[1], "Workflow Integration API metadata-only scripting proof.\n");
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  return writeFile(join(workspaceRoot, ...relativePath.split("/")), source);
}

function writeFile(path: string, source: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
