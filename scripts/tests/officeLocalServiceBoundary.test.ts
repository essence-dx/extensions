import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createDxOfficeLocalServiceRequest,
  describeDxOfficeServiceConnectionNotice,
  isDxOfficeLocalServicePlan
} from "../../hosts/office/shared/localServiceBoundary.ts";
import { validateOfficeLocalServiceBoundary } from "../validate-office-local-service-boundary.ts";

const root = process.cwd();

const statusPlan = {
  messageType: "dx.excel.show_status",
  operation: "dx.status",
  transport: "local-service",
  requiresRuntimeProof: true
} as const;

const receiptPlan = {
  messageType: "dx.excel.copy_receipts_path",
  operation: "receipt.copyPath",
  transport: "host-ui",
  requiresRuntimeProof: false
} as const;

assert.equal(isDxOfficeLocalServicePlan(statusPlan), true);
assert.equal(isDxOfficeLocalServicePlan(receiptPlan), false);

const request = createDxOfficeLocalServiceRequest({
  host: "excel",
  command: statusPlan.messageType,
  plan: statusPlan,
  query: "  icons  ",
  context: {
    hostDocumentState: "loaded"
  }
});

assert.deepEqual(request, {
  protocol: "dx.office.local-service",
  schemaVersion: 1,
  host: "excel",
  command: "dx.excel.show_status",
  operation: "dx.status",
  query: "icons",
  context: {
    hostDocumentState: "loaded"
  }
});

assert.equal(JSON.stringify(request).includes("Brand kit.xlsx"), false);
assert.equal(JSON.stringify(request).includes("https://"), false);

assert.throws(
  () =>
    createDxOfficeLocalServiceRequest({
      host: "excel",
      command: receiptPlan.messageType,
      plan: receiptPlan
    }),
  /local-service command plan/
);

assert.match(
  describeDxOfficeServiceConnectionNotice(request),
  /DX service connection is not configured for Excel\. Operation: dx\.status\./
);

const boundarySource = readFileSync(join(root, "hosts", "office", "shared", "localServiceBoundary.ts"), "utf8");
assert.doesNotMatch(boundarySource, /local-service proof|ProofBlock/i);

for (const taskpanePath of [
  "hosts/office/dx-excel/src/taskpane.ts",
  "hosts/office/dx-powerpoint/src/taskpane.ts",
  "hosts/office/dx-word/src/taskpane.ts"
]) {
  const taskpaneSource = readFileSync(join(root, taskpanePath), "utf8");
  assert.match(taskpaneSource, /\.\.\/\.\.\/shared\/localServiceBoundary/);
  assert.match(taskpaneSource, /createDxOfficeLocalServiceRequest/);
  assert.match(taskpaneSource, /describeDxOfficeServiceConnectionNotice/);
  assert.match(taskpaneSource, /isDxOfficeLocalServicePlan/);
  assert.doesNotMatch(taskpaneSource, /describeDxOfficeLocalServiceProofBlock|local-service proof/i);
  assert.doesNotMatch(taskpaneSource, /presentationUrl|documentUrl|workbookName/);
  assert.doesNotMatch(taskpaneSource, /fetch\(|XMLHttpRequest|child_process|spawn\(|exec\(|execFile\(|PowerShell|cmd\.exe|bash|sh -c|shell/i);
}

assert.deepEqual(validateOfficeLocalServiceBoundary(root), []);

console.log("Office local-service boundary verified");
