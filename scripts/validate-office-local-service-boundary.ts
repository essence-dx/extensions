import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseTomlDocument } from "./lib/toml-lite.ts";

interface OfficeHostContract {
  name: "Excel" | "PowerPoint" | "Word";
  slug: "dx-excel" | "dx-powerpoint" | "dx-word";
  receiptPlanName: "copyReceiptsPath";
  mutationPattern?: RegExp;
}

const officeHosts: OfficeHostContract[] = [
  {
    name: "Excel",
    slug: "dx-excel",
    receiptPlanName: "copyReceiptsPath"
  },
  {
    name: "PowerPoint",
    slug: "dx-powerpoint",
    receiptPlanName: "copyReceiptsPath"
  },
  {
    name: "Word",
    slug: "dx-word",
    receiptPlanName: "copyReceiptsPath",
    mutationPattern:
      /\b(?:insertText|insertFile|setSelectedDataAsync|insertHtml|insertOoxml|insertFileFromBase64|insertInlinePictureFromBase64|insertParagraph|insertTable|insertBreak|insertContentControl|getSelectedDataAsync|getHtml|getOoxml|clear)\b|\.delete\s*\(|font\.set|styleBuiltIn\s*=|style\s*=|document\.body\.text|body\.search|contentControls/i
  }
];

const forbiddenRuntimePattern =
  /fetch\(|XMLHttpRequest|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i;

export function validateOfficeLocalServiceBoundary(root = process.cwd()) {
  const failures: string[] = [];
  const sharedBoundaryPath = join(root, "hosts", "office", "shared", "localServiceBoundary.ts");

  if (!existsSync(sharedBoundaryPath)) {
    return ["hosts/office/shared/localServiceBoundary.ts is required"];
  }

  const sharedBoundarySource = readFileSync(sharedBoundaryPath, "utf8");
  requireSourceText(
    failures,
    "hosts/office/shared/localServiceBoundary.ts",
    sharedBoundarySource,
    "dx.office.local-service",
    "must define the Office local-service protocol"
  );
  requireSourceText(
    failures,
    "hosts/office/shared/localServiceBoundary.ts",
    sharedBoundarySource,
    "isDxOfficeLocalServicePlan",
    "must expose a local-service plan guard"
  );

  if (/workbookName|presentationUrl|documentUrl/.test(sharedBoundarySource)) {
    failures.push("hosts/office/shared/localServiceBoundary.ts must not carry raw Office document identifiers");
  }

  for (const host of officeHosts) {
    validateOfficeHost(root, host, failures);
  }

  return failures;
}

function validateOfficeHost(root: string, host: OfficeHostContract, failures: string[]) {
  const hostRoot = join(root, "hosts", "office", host.slug);
  const dxManifestPath = join(hostRoot, "dx.extension.toml");
  const commandPlansPath = join(hostRoot, "src", "commandPlans.ts");
  const taskpanePath = join(hostRoot, "src", "taskpane.ts");

  for (const path of [dxManifestPath, commandPlansPath, taskpanePath]) {
    if (!existsSync(path)) {
      failures.push(`${path} is required`);
      return;
    }
  }

  const manifest = parseTomlDocument(readFileSync(dxManifestPath, "utf8"));
  const capabilityIds = (manifest.arrays.capabilities ?? []).map((capability) => capability.id);

  if (manifest.sections.entrypoint.transport !== "http") {
    failures.push(`${host.slug} entrypoint.transport must stay http for Office web add-ins`);
  }

  if (manifest.sections.entrypoint.command !== "dx-local-service") {
    failures.push(`${host.slug} entrypoint.command must be dx-local-service`);
  }

  if (!capabilityIds.includes("local_service.connect")) {
    failures.push(`${host.slug} must declare local_service.connect`);
  }

  const commandPlansSource = readFileSync(commandPlansPath, "utf8");
  requireReceiptHostUiPlan(host, commandPlansSource, failures);
  requireSourceText(
    failures,
    `${host.slug}/src/commandPlans.ts`,
    commandPlansSource,
    'transport: "local-service"',
    "must keep status/search actions on the local-service transport"
  );

  const taskpaneSource = readFileSync(taskpanePath, "utf8");
  requireSourceText(
    failures,
    `${host.slug}/src/taskpane.ts`,
    taskpaneSource,
    "../../shared/localServiceBoundary",
    "must import the shared Office boundary"
  );
  requireSourceText(
    failures,
    `${host.slug}/src/taskpane.ts`,
    taskpaneSource,
    "createDxOfficeLocalServiceRequest",
    "must create typed local-service requests"
  );
  requireSourceText(
    failures,
    `${host.slug}/src/taskpane.ts`,
    taskpaneSource,
    "describeDxOfficeServiceConnectionNotice",
    "must keep service-connection status visible"
  );
  requireSourceText(
    failures,
    `${host.slug}/src/taskpane.ts`,
    taskpaneSource,
    "isDxOfficeLocalServicePlan",
    "must guard plan transport before creating local-service requests"
  );

  if (/presentationUrl|documentUrl|workbookName/.test(taskpaneSource)) {
    failures.push(`${host.slug}/src/taskpane.ts must not pass raw Office document identifiers`);
  }

  if (forbiddenRuntimePattern.test(taskpaneSource)) {
    failures.push(`${host.slug}/src/taskpane.ts must not call local processes, shells, or network clients`);
  }

  if (/OfficeRuntime\.auth\.getAccessToken/i.test(taskpaneSource)) {
    failures.push(`${host.slug}/src/taskpane.ts must not request broad Office auth`);
  }

  if (host.mutationPattern?.test(taskpaneSource)) {
    failures.push(`${host.slug}/src/taskpane.ts must keep Word document mutation APIs out of the adapter`);
  }
}

function requireReceiptHostUiPlan(
  host: OfficeHostContract,
  commandPlansSource: string,
  failures: string[]
) {
  const receiptPlanPattern = new RegExp(
    `${host.receiptPlanName}:\\s*{[\\s\\S]*operation:\\s*"receipt\\.copyPath"[\\s\\S]*transport:\\s*"host-ui"[\\s\\S]*requiresRuntimeProof:\\s*false[\\s\\S]*}`
  );

  if (!receiptPlanPattern.test(commandPlansSource)) {
    failures.push(`${host.slug}/src/commandPlans.ts receipt.copyPath must stay host-ui without runtime proof`);
  }
}

function requireSourceText(
  failures: string[],
  relativePath: string,
  source: string,
  text: string,
  message: string
) {
  if (!source.includes(text)) {
    failures.push(`${relativePath} ${message}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = validateOfficeLocalServiceBoundary();

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("Office local-service boundary metadata verified");
}
