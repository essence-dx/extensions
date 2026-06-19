import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const officeReleaseGapAdapters = [
  {
    adapterId: "dx.excel.command-center",
    commandIds: ["dx.excel.show_status", "dx.excel.search_assets"],
    host: "excel",
    officeApplication: "Excel",
    packageFolder: "dx-excel",
    professionalTarget: "microsoft.excel.office-add-in",
    searchOperation: "dx.assets.search",
    sideloadCommandIds: ["dx.excel.show_status", "dx.excel.search_assets", "dx.excel.copy_receipts_path"]
  },
  {
    adapterId: "dx.powerpoint.command-center",
    commandIds: ["dx.powerpoint.show_status", "dx.powerpoint.search_media"],
    host: "powerpoint",
    officeApplication: "PowerPoint",
    packageFolder: "dx-powerpoint",
    professionalTarget: "microsoft.powerpoint.office-add-in",
    searchOperation: "dx.media.search",
    sideloadCommandIds: [
      "dx.powerpoint.show_status",
      "dx.powerpoint.search_media",
      "dx.powerpoint.copy_receipts_path"
    ]
  },
  {
    adapterId: "dx.word.command-center",
    commandIds: ["dx.word.show_status", "dx.word.search_assets"],
    host: "word",
    officeApplication: "Word",
    packageFolder: "dx-word",
    professionalTarget: "microsoft.word.office-add-in",
    searchOperation: "dx.assets.search",
    sideloadCommandIds: ["dx.word.show_status", "dx.word.search_assets", "dx.word.copy_receipts_path"]
  }
] as const;

type OfficeReleaseGapAdapter = (typeof officeReleaseGapAdapters)[number];

export function writeOfficeLocalServiceReleaseGapFixtures(workspaceRoot: string): void {
  writeRegistryFixtures(workspaceRoot);

  for (const adapter of officeReleaseGapAdapters) {
    const packageOutputReceiptPath = writePackageOutputReceipt(workspaceRoot, adapter);
    const sideloadedHostReceiptPath = writeSideloadedHostReceipt(
      workspaceRoot,
      adapter,
      packageOutputReceiptPath
    );

    writeOfficeLocalServiceReceipt(workspaceRoot, adapter, sideloadedHostReceiptPath);
  }
}

function writeRegistryFixtures(workspaceRoot: string): void {
  writeWorkspaceFile(
    workspaceRoot,
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

${officeReleaseGapAdapters
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
name = "${adapter.adapterId}"
path = "hosts/office/${adapter.packageFolder}"
manifest = "hosts/office/${adapter.packageFolder}/dx.extension.toml"
status = "experimental"
professional_targets = ["${adapter.professionalTarget}"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of officeReleaseGapAdapters) {
    writeWorkspaceFile(
      workspaceRoot,
      `hosts/office/${adapter.packageFolder}/dx.extension.toml`,
      `[extension]\nid = "${adapter.adapterId}"\n`
    );
  }

  writeWorkspaceFile(
    workspaceRoot,
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

${officeReleaseGapAdapters.map(writeReleaseGateEntry).join("\n")}
`
  );
}

function writeReleaseGateEntry(adapter: OfficeReleaseGapAdapter): string {
  return `
[[extensions]]
id = "${adapter.adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "signing", "checksum", "distribution_review", "appsource_review", "local_service"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/sideloaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "local_service=.dx/receipts/extensions/${adapter.adapterId}/local-service-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/appsource-review-latest.json", "appsource_review=.dx/receipts/extensions/${adapter.adapterId}/appsource-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/sideloaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/local-service-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/appsource-review-latest.json"]
next_release_proof = "Capture ${adapter.officeApplication} AppSource release evidence"
blocked_by = ["AppSource review", "signing", "public release checksum"]
`;
}

function writePackageOutputReceipt(workspaceRoot: string, adapter: OfficeReleaseGapAdapter): string {
  const packageRoot = join(workspaceRoot, "packages", adapter.host);
  const sourceRoot = join(workspaceRoot, "hosts", "office");
  const sourceInputs = writeSourceInputs(workspaceRoot, adapter);
  const files = ["manifest.xml", "taskpane.html"].map((relativePath) => {
    const absolutePath = writeWorkspaceFile(
      workspaceRoot,
      `packages/${adapter.host}/${relativePath}`,
      `${adapter.officeApplication} ${relativePath}\n`
    );
    const bytes = readFileSync(absolutePath);

    return {
      relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes)
    };
  });

  return writeJsonFile(workspaceRoot, `.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json`, {
    receipt: "dx.extension.office_taskpane.package_output",
    adapterId: adapter.adapterId,
    host: adapter.host,
    package: {
      root: packageRoot,
      fileCount: files.length,
      sha256: hashPackageFiles(files),
      files
    },
    sourceRoot,
    sourceInputs,
    sourceSha256: hashPackageFiles(sourceInputs),
    manifest: {
      officeHost: officeManifestHostFor(adapter),
      permission: "ReadDocument",
      taskpaneUrl: `https://localhost:3979/${adapter.host}/taskpane.html`,
      placeholderOriginRemoved: true
    },
    releaseClaims: {
      sideloadedHostVerified: false,
      localServiceVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    }
  });
}

function writeSourceInputs(
  workspaceRoot: string,
  adapter: OfficeReleaseGapAdapter
): Array<{ relativePath: string; bytes: number; sha256: string }> {
  return [
    writeSourceInput(
      workspaceRoot,
      `hosts/office/${adapter.packageFolder}/manifest.xml`,
      `<OfficeApp><Hosts><Host Name="${officeManifestHostFor(adapter)}"/></Hosts></OfficeApp>\n`
    ),
    writeSourceInput(
      workspaceRoot,
      `hosts/office/${adapter.packageFolder}/src/commandPlans.ts`,
      `export const commandPlans = ${JSON.stringify(adapter.commandIds)};\n`
    ),
    writeSourceInput(
      workspaceRoot,
      `hosts/office/${adapter.packageFolder}/src/messages.ts`,
      `export const host = ${JSON.stringify(adapter.host)};\n`
    ),
    writeSourceInput(
      workspaceRoot,
      `hosts/office/${adapter.packageFolder}/src/taskpane.ts`,
      `export const taskpane = ${JSON.stringify(adapter.officeApplication)};\n`
    ),
    writeSourceInput(
      workspaceRoot,
      `hosts/office/${adapter.packageFolder}/static/taskpane.html`,
      `<main>${adapter.officeApplication} taskpane</main>\n`
    ),
    writeSourceInput(
      workspaceRoot,
      "hosts/office/shared/localServiceBoundary.ts",
      "export const protocol = 'dx.office.local-service';\n"
    )
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function writeSourceInput(
  workspaceRoot: string,
  workspaceRelativePath: string,
  source: string
): { relativePath: string; bytes: number; sha256: string } {
  const absolutePath = writeWorkspaceFile(workspaceRoot, workspaceRelativePath, source);
  const bytes = readFileSync(absolutePath);
  const relativePath = workspaceRelativePath.replace("hosts/office/", "");

  return {
    relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function writeSideloadedHostReceipt(
  workspaceRoot: string,
  adapter: OfficeReleaseGapAdapter,
  packageOutputReceiptPath: string
): string {
  const proofFilePath = writeWorkspaceFile(
    workspaceRoot,
    `proof/${adapter.host}-sideloaded-host.txt`,
    `${adapter.officeApplication} sideloaded taskpane proof.\n`
  );

  return writeJsonFile(workspaceRoot, `.dx/receipts/extensions/${adapter.adapterId}/sideloaded-host-latest.json`, {
    receipt: "dx.extension.office_taskpane.sideloaded_host",
    adapterId: adapter.adapterId,
    host: adapter.host,
    packageOutput: {
      receiptPath: packageOutputReceiptPath,
      receiptSha256: sha256(readFileSync(packageOutputReceiptPath)),
      packageSha256: readPackageOutputSha256(packageOutputReceiptPath)
    },
    sideload: {
      manifestPath: join(workspaceRoot, "packages", adapter.host, "manifest.xml"),
      manifestSha256: readPackageFileSha256(packageOutputReceiptPath, "manifest.xml"),
      taskpaneUrl: `https://localhost:3979/${adapter.host}/taskpane.html`,
      taskpaneLoaded: true,
      localServiceRequestsBlocked: true,
      commandIdsVisible: [...adapter.sideloadCommandIds],
      commandResults: adapter.sideloadCommandIds.map((commandId) => ({
        commandId,
        status: commandId.endsWith("show_status") ? "clicked" : "proof-blocked"
      }))
    },
    manualProof: {
      proofFilePath,
      proofFileSha256: sha256(readFileSync(proofFilePath))
    },
    releaseClaims: {
      sideloadedHostVerified: true,
      localServiceVerified: false,
      signingVerified: false,
      appSourceApproved: false
    }
  });
}

function writeOfficeLocalServiceReceipt(
  workspaceRoot: string,
  adapter: OfficeReleaseGapAdapter,
  sideloadedHostReceiptPath: string
): string {
  const proofFilePath = writeWorkspaceFile(
    workspaceRoot,
    `proof/${adapter.host}-local-service.txt`,
    `${adapter.officeApplication} local-service metadata-only proof.\n`
  );

  return writeJsonFile(workspaceRoot, `.dx/receipts/extensions/${adapter.adapterId}/local-service-latest.json`, {
    receipt: "dx.extension.office_taskpane.local_service",
    adapterId: adapter.adapterId,
    host: adapter.host,
    office: {
      application: adapter.officeApplication,
      version: "16.0.17726.20160"
    },
    sideloadedHost: {
      receiptPath: sideloadedHostReceiptPath,
      receiptSha256: sha256(readFileSync(sideloadedHostReceiptPath))
    },
    localService: {
      transport: "loopback",
      connected: true,
      documentState: "loaded",
      requests: [
        officeRequest(adapter, adapter.commandIds[0], "dx.status"),
        officeRequest(adapter, adapter.commandIds[1], adapter.searchOperation)
      ],
      responses: adapter.commandIds.map((command) => ({
        command,
        status: "ok",
        payloadKind: "metadata-only"
      }))
    },
    manualProof: {
      proofFilePath,
      proofFileSha256: sha256(readFileSync(proofFilePath))
    },
    releaseClaims: {
      sideloadedHostVerified: true,
      localServiceVerified: true,
      signingVerified: false,
      releaseChecksumVerified: false,
      appSourceApproved: false,
      distributionVerified: false
    }
  });
}

function officeRequest(adapter: OfficeReleaseGapAdapter, command: string, operation: string) {
  return {
    protocol: "dx.office.local-service",
    schemaVersion: 1,
    host: adapter.host,
    command,
    operation,
    context: {
      hostDocumentState: "loaded"
    }
  };
}

function writeJsonFile(workspaceRoot: string, relativePath: string, value: unknown): string {
  return writeWorkspaceFile(workspaceRoot, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readPackageOutputSha256(packageOutputReceiptPath: string): string {
  const receipt = JSON.parse(readFileSync(packageOutputReceiptPath, "utf8"));

  return receipt.package.sha256;
}

function readPackageFileSha256(packageOutputReceiptPath: string, relativePath: string): string {
  const receipt = JSON.parse(readFileSync(packageOutputReceiptPath, "utf8"));
  const file = receipt.package.files.find((entry: { relativePath: string }) => entry.relativePath === relativePath);

  return file.sha256;
}

function officeManifestHostFor(adapter: OfficeReleaseGapAdapter): string {
  if (adapter.officeApplication === "Excel") {
    return "Workbook";
  }

  if (adapter.officeApplication === "PowerPoint") {
    return "Presentation";
  }

  return "Document";
}

function writeWorkspaceFile(workspaceRoot: string, relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

function sha256(bytes: Buffer | string): string {
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
