import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

interface PackageCommand {
  command: string;
}

interface PackageManifest extends Record<string, unknown> {
  activationEvents: string[];
  contributes: {
    commands: PackageCommand[];
  };
}

interface PackageFixtureOptions {
  readme?: false;
  ignoreSource?: string;
}

const verifierPath = fileURLToPath(
  new URL("../verify-vscode-package.ts", import.meta.url)
);
const packagePath = fileURLToPath(
  new URL("../../hosts/vscode/dx-vscode/package.json", import.meta.url)
);
const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-vscode-package-verifier-"));

try {
  const validResult = runVerifier(packagePath);
  assert.equal(validResult.status, 0, validResult.stderr);

  const missingContributionPath = writePackage("missing-contribution", (manifest) => {
    manifest.contributes.commands = manifest.contributes.commands.filter(
      (command) => command.command !== "dx.showLatestCheckReceipt"
    );
  });
  const missingContribution = runVerifier(missingContributionPath);
  assert.notEqual(missingContribution.status, 0);
  assert.match(
    missingContribution.stderr,
    /missing command contribution: dx\.showLatestCheckReceipt/
  );

  const missingActivationPath = writePackage("missing-activation", (manifest) => {
    manifest.activationEvents = manifest.activationEvents.filter(
      (event) => event !== "onCommand:dx.showCheckEditorState"
    );
  });
  const missingActivation = runVerifier(missingActivationPath);
  assert.notEqual(missingActivation.status, 0);
  assert.match(
    missingActivation.stderr,
    /missing command activation event: dx\.showCheckEditorState/
  );

  const unexpectedContributionPath = writePackage(
    "unexpected-contribution",
    (manifest) => {
      manifest.contributes.commands.push({
        command: "dx.experimentalHidden"
      });
      manifest.activationEvents.push("onCommand:dx.experimentalHidden");
    }
  );
  const unexpectedContribution = runVerifier(unexpectedContributionPath);
  assert.notEqual(unexpectedContribution.status, 0);
  assert.match(
    unexpectedContribution.stderr,
    /unexpected command contribution: dx\.experimentalHidden/
  );

  const missingReadmePath = writePackage("missing-readme", () => {}, {
    readme: false
  });
  const missingReadme = runVerifier(missingReadmePath);
  assert.notEqual(missingReadme.status, 0);
  assert.match(
    missingReadme.stderr,
    /VS Code extension package must include README\.md/
  );

  const incompleteIgnorePath = writePackage("incomplete-ignore", () => {}, {
    ignoreSource: "src/**\n"
  });
  const incompleteIgnore = runVerifier(incompleteIgnorePath);
  assert.notEqual(incompleteIgnore.status, 0);
  assert.match(
    incompleteIgnore.stderr,
    /VS Code \.vscodeignore must exclude tests\/\*\*/
  );

  const missingSourceMapIgnorePath = writePackage("missing-source-map-ignore", () => {}, {
    ignoreSource: [
      "src/**",
      "tests/**",
      "tsconfig.json",
      "dx.extension.toml",
      "*.vsix"
    ].join("\n")
  });
  const missingSourceMapIgnore = runVerifier(missingSourceMapIgnorePath);
  assert.notEqual(missingSourceMapIgnore.status, 0);
  assert.match(
    missingSourceMapIgnore.stderr,
    /VS Code \.vscodeignore must exclude dist\/\*\*\/\*\.map/
  );
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("vscode package verifier coverage verified");

function writePackage(
  directoryName: string,
  mutate: (manifest: PackageManifest) => void,
  options: PackageFixtureOptions = {}
): string {
  const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as PackageManifest;
  mutate(manifest);

  const packageDirectory = join(workspaceRoot, directoryName);
  const absolutePath = join(packageDirectory, "package.json");
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(manifest, null, 2)}\n`);
  writePackageSupportFiles(packageDirectory, options);
  return absolutePath;
}

function writePackageSupportFiles(
  packageDirectory: string,
  options: PackageFixtureOptions
): void {
  if (options.readme !== false) {
    writeFileSync(
      join(packageDirectory, "README.md"),
      [
        "# DX Command Center",
        "",
        "DX CLI commands require workspace trust and receipt actions stay host-side.",
        "The package documents receipts for operators."
      ].join("\n")
    );
  }

  writeFileSync(
    join(packageDirectory, ".vscodeignore"),
    options.ignoreSource ??
      [
        "src/**",
        "tests/**",
        "tsconfig.json",
        "dx.extension.toml",
        "dist/**/*.map",
        "*.vsix"
      ].join("\n")
  );
}

function runVerifier(targetPackagePath: string): {
  status: number | null;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", verifierPath, targetPackagePath],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );

  return {
    status: result.status,
    stderr: `${result.stderr}${result.stdout}`
  };
}
