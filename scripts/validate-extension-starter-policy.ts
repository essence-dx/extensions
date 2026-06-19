import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, normalize } from "node:path";

const starterGuidePath = "docs/official-extension-starter.md";
const requiredGuidePhrases = [
  ["registry-first", "must require registry-first creation"],
  ["host SDK and distribution evidence", "must require host SDK and distribution evidence"],
  ["permission and sandbox model", "must require permission and sandbox review"],
  ["DX CLI or local service boundary", "must require the DX CLI or local service boundary"],
  ["manifest and registry identity", "must require manifest and registry identity"],
  ["j1 verification", "must require j1 verification"],
  ["metadata-only receipts", "must require metadata-only receipts"],
  ["package signing and checksums", "must require package signing and checksums"],
  ["loaded-host smoke plan", "must require a loaded-host smoke plan"],
  ["does not prove marketplace readiness", "must avoid marketplace readiness overclaims"]
];

export function validateOfficialExtensionStarterPolicy(root) {
  const guidePath = join(root, starterGuidePath);

  if (!existsSync(guidePath)) {
    return [`missing official extension starter guide: ${starterGuidePath}`];
  }

  const guideSource = readFileSync(guidePath, "utf8");
  const normalizedGuide = normalizeWhitespace(guideSource);
  const failures = [];

  for (const [phrase, message] of requiredGuidePhrases) {
    if (!normalizedGuide.includes(phrase.toLowerCase())) {
      failures.push(`official extension starter guide ${message}`);
    }
  }

  return failures;
}

function normalizeWhitespace(source) {
  return source.toLowerCase().replace(/\s+/g, " ").trim();
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  const failures = validateOfficialExtensionStarterPolicy(process.cwd());

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("official extension starter policy verified");
}
