import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const packageJson = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const guardedWrapperScripts = readdirSync(join(workspaceRoot, "scripts"))
  .filter((entry) => entry.endsWith("-j1.ps1"))
  .map((entry) => `scripts/${entry}`)
  .sort();

for (const relativePath of guardedWrapperScripts) {
  const source = readFileSync(join(workspaceRoot, relativePath), "utf8");
  const serialIndex = source.indexOf("Set-DxSerialBuildEnvironment");
  const guardIndex = source.indexOf("Assert-NoCompetingHeavyProcess");
  const pushLocationIndex = source.indexOf("Push-Location");

  assert.notEqual(serialIndex, -1, `${relativePath} must set the serial build environment.`);
  assert.notEqual(guardIndex, -1, `${relativePath} must reject competing heavy processes.`);
  if (pushLocationIndex !== -1) {
    assert.ok(
      serialIndex < guardIndex && guardIndex < pushLocationIndex,
      `${relativePath} must run the process guard after serial environment setup and before Push-Location.`
    );
  }

  assertPackageEvidenceWrapperRefreshesPreflight(relativePath, source);
}

const testJ1Source = readFileSync(join(workspaceRoot, "scripts", "test-j1.ps1"), "utf8");
const commandPolicySource = readFileSync(join(workspaceRoot, "scripts", "command-policy.ps1"), "utf8");
const releaseEvidenceGapReportTests = Object.keys(packageJson.scripts ?? {})
  .filter((scriptName) => scriptName.startsWith("test:release-evidence-gap-report"))
  .sort();
const extensionProgressReportTests = Object.keys(packageJson.scripts ?? {})
  .filter((scriptName) => scriptName.startsWith("test:extension-progress"))
  .sort();

assert.notEqual(
  releaseEvidenceGapReportTests.length,
  0,
  "package.json must define release-evidence gap report tests."
);
assert.notEqual(
  extensionProgressReportTests.length,
  0,
  "package.json must define extension progress report tests."
);

assert.match(commandPolicySource, /function Get-DxCompetingHeavyProcess/);
assert.match(commandPolicySource, /DX_HEAVY_PROCESS_GUARD_TIMEOUT_SECONDS/);
assert.match(commandPolicySource, /Start-Sleep -Seconds/);
assert.match(commandPolicySource, /while \(\$true\)/);

assertWrapperInvokesTests("scripts/test-j1.ps1", testJ1Source, releaseEvidenceGapReportTests);
assertWrapperInvokesTests(
  "scripts/report-release-evidence-gaps-j1.ps1",
  readFileSync(join(workspaceRoot, "scripts", "report-release-evidence-gaps-j1.ps1"), "utf8"),
  releaseEvidenceGapReportTests
);
assertWrapperInvokesTests("scripts/test-j1.ps1", testJ1Source, extensionProgressReportTests);
assertWrapperInvokesTests(
  "scripts/report-extension-progress-j1.ps1",
  readFileSync(join(workspaceRoot, "scripts", "report-extension-progress-j1.ps1"), "utf8"),
  extensionProgressReportTests
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-browser-j1.ps1",
  "scripts/write-browser-package-output-receipt.ts",
  "dx.browser.command-center",
  "npm run build:browser:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-vscode-j1.ps1",
  "scripts/write-vscode-package-output-receipt.ts",
  "dx.vscode.command-center",
  "npm run package:vscode:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-blender-j1.ps1",
  "scripts/write-blender-package-output-receipt.ts",
  "dx.blender.command-center",
  "npm run build:blender:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-obsidian-j1.ps1",
  "scripts/write-obsidian-package-output-receipt.ts",
  "dx.obsidian.command-center",
  "npm run build:obsidian:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-figma-j1.ps1",
  "scripts/write-figma-canva-package-output-receipts.ts",
  "dx.figma.command-center",
  "npm run build:figma:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-canva-j1.ps1",
  "scripts/write-figma-canva-package-output-receipts.ts",
  "dx.canva.command-center",
  "npm run build:canva:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-sketch-j1.ps1",
  "scripts/write-sketch-package-output-receipt.ts",
  "dx.sketch.command-center",
  "npm run build:sketch:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-office-taskpane-j1.ps1",
  "scripts/write-office-package-output-receipts.ts",
  "dx.excel.command-center",
  "npm run build:office-taskpane:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-office-taskpane-j1.ps1",
  "scripts/write-office-package-output-receipts.ts",
  "dx.powerpoint.command-center",
  "npm run build:office-taskpane:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-office-taskpane-j1.ps1",
  "scripts/write-office-package-output-receipts.ts",
  "dx.word.command-center",
  "npm run build:office-taskpane:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-zed-j1.ps1",
  "scripts/write-zed-package-output-receipt.ts",
  "dx.zed.command-center",
  "npm run package:zed:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-adobe-uxp-j1.ps1",
  "scripts/write-adobe-uxp-package-output-receipts.ts",
  "dx.photoshop.command-center",
  "npm run build:adobe-uxp:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-adobe-uxp-j1.ps1",
  "scripts/write-adobe-uxp-package-output-receipts.ts",
  "dx.premiere-pro.command-center",
  "npm run build:adobe-uxp:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-adobe-uxp-j1.ps1",
  "scripts/write-adobe-uxp-package-output-receipts.ts",
  "dx.indesign.command-center",
  "npm run build:adobe-uxp:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-davinci-resolve-j1.ps1",
  "scripts/write-davinci-resolve-package-output-receipt.ts",
  "dx.davinci-resolve.command-center",
  "npm run package:davinci-resolve:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-intellij-platform-j1.ps1",
  "scripts/write-intellij-platform-package-output-receipt.ts",
  "dx.intellij-platform.command-center",
  "npm run package:intellij-platform:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-visual-studio-j1.ps1",
  "scripts/write-visual-studio-package-output-receipt.ts",
  "dx.visual-studio.command-center",
  "npm run package:visual-studio:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-unity-editor-j1.ps1",
  "scripts/write-unity-editor-package-output-receipt.ts",
  "dx.unity-editor.command-center",
  "npm run package:unity-editor:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-unreal-engine-j1.ps1",
  "scripts/write-unreal-engine-package-output-receipt.ts",
  "dx.unreal-engine.command-center",
  "npm run package:unreal-engine:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/build-google-workspace-apps-script-j1.ps1",
  "scripts/write-google-workspace-apps-script-package-output-receipt.ts",
  "dx.google-workspace.command-center",
  "npm run build:google-workspace-apps-script:j1"
);
assertPackageOutputWrapperRefreshesPreflight(
  "scripts/package-affinity-content-j1.ps1",
  "scripts/write-affinity-content-package-receipt.ts",
  "dx.affinity-content.bridge",
  "npm run package:affinity-content:j1"
);

console.log("j1 wrapper process guards verified");

function assertWrapperInvokesTests(
  relativePath: string,
  source: string,
  scriptNames: string[]
): void {
  const missingScripts = scriptNames.filter((scriptName) => !source.includes(`"${scriptName}"`));

  assert.deepEqual(
    missingScripts,
    [],
    `${relativePath} must invoke every required aggregate test.`
  );
}

function assertPackageEvidenceWrapperRefreshesPreflight(relativePath: string, source: string): void {
  const packageWriterMatch = source.match(
    /scripts\/write-[^"]*(?:package-output|content-package)-receipt[s]?\.ts/
  );

  if (!packageWriterMatch || packageWriterMatch.index === undefined) {
    return;
  }

  const preflightWriterIndex = source.indexOf("scripts/write-loaded-host-preflight-receipts.ts");

  assert.notEqual(
    preflightWriterIndex,
    -1,
    `${relativePath} must refresh loaded-host preflight after package evidence receipts.`
  );
  assert.ok(
    packageWriterMatch.index < preflightWriterIndex,
    `${relativePath} must refresh loaded-host preflight after package evidence receipts.`
  );
}

function assertPackageOutputWrapperRefreshesPreflight(
  relativePath: string,
  packageOutputWriterPath: string,
  adapterId: string,
  verificationCommand: string
): void {
  const source = readFileSync(join(workspaceRoot, relativePath), "utf8");
  const packageOutputWriterIndex = source.indexOf(packageOutputWriterPath);
  const preflightWriterIndex = source.indexOf(
    `Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "${adapterId}", "--verification-command", "${verificationCommand}")`
  );

  assert.notEqual(packageOutputWriterIndex, -1, `${relativePath} must write package-output receipts.`);
  assert.notEqual(
    preflightWriterIndex,
    -1,
    `${relativePath} must refresh loaded-host preflight for ${adapterId}.`
  );
  assert.ok(
    packageOutputWriterIndex < preflightWriterIndex,
    `${relativePath} must refresh loaded-host preflight after package-output receipts.`
  );
}
