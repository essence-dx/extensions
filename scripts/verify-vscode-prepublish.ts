import { readFileSync } from "node:fs";

const packagePath = process.argv[2];
if (!packagePath) {
  console.error("usage: node --experimental-strip-types scripts/verify-vscode-prepublish.ts <package.json>");
  process.exit(1);
}

const failures = [];
if (process.env.DX_VSCODE_PACKAGE_J1 !== "1") {
  failures.push("VS Code packaging must use npm run package:vscode:j1 from the workspace root");
}

const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
  failures.push("VS Code runtime dependencies must be bundled before --no-dependencies packaging");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("vscode prepublish guard verified");
