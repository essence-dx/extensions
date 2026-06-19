import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseTomlDocument } from "../lib/toml-lite.ts";

const adobeUxpAdapters = [
  "dx.photoshop.command-center",
  "dx.premiere-pro.command-center",
  "dx.indesign.command-center"
];
const releaseGatesPath = join(process.cwd(), "registry", "release-evidence-gates.toml");
const releaseGates = parseTomlDocument(readFileSync(releaseGatesPath, "utf8"));

for (const adapterId of adobeUxpAdapters) {
  const gate = (releaseGates.arrays.extensions ?? []).find((entry) => entry.id === adapterId);
  const pluginIdReceiptPath = `.dx/receipts/extensions/${adapterId}/plugin-id-latest.json`;
  const pluginIdRequirement = `plugin_id=${pluginIdReceiptPath}`;

  assert.ok(gate, `${adapterId} release gate must exist.`);
  assert.ok(
    gate.required_evidence.includes("plugin_id"),
    `${adapterId} must require Adobe Developer Console plugin-id proof.`
  );
  assert.ok(
    gate.evidence_receipt_requirements.includes(pluginIdRequirement),
    `${adapterId} must map plugin_id to ${pluginIdReceiptPath}.`
  );
  assert.ok(
    gate.evidence_receipts.includes(pluginIdReceiptPath),
    `${adapterId} must include the plugin-id receipt path.`
  );
  assert.match(
    gate.next_release_proof,
    /Developer Console|plugin ID/i,
    `${adapterId} next release proof must mention plugin ID capture.`
  );
  assert.ok(
    gate.blocked_by.some((blocker: string) => /Developer Console|plugin ID/i.test(blocker)),
    `${adapterId} blockers must mention plugin ID proof.`
  );
}

console.log("Adobe UXP plugin-id release gates verified");
