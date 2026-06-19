import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

export interface SourceInputProof {
  relativePath: string;
  bytes: number;
  sha256: string;
}

export interface SourceInputProofReceipt {
  sourceRoot?: unknown;
  sourceInputs?: unknown;
  sourceSha256?: unknown;
}

const googleWorkspaceSourceInputs = [
  "appsscript.json",
  "src/cards.ts",
  "src/commandPlans.ts",
  "src/entrypoints.ts",
  "src/localServiceBoundary.ts",
  "src/messages.ts"
];
const officeSourceFolderByAdapter = new Map([
  ["dx.excel.command-center", "dx-excel"],
  ["dx.powerpoint.command-center", "dx-powerpoint"],
  ["dx.word.command-center", "dx-word"]
]);
export const browserPackageSourceInputs = [
  "manifests/manifest.chromium.json",
  "manifests/manifest.edge.json",
  "manifests/manifest.firefox.json",
  "package.json",
  "src/background/chromium.ts",
  "src/background/common.ts",
  "src/background/firefox.ts",
  "src/background/messageSender.ts",
  "src/background/platform.ts",
  "src/runtime/commandPlans.ts",
  "src/runtime/messages.ts",
  "src/runtime/nativeHostTransport.ts",
  "src/runtime/protocol.ts",
  "src/ui/bootstrapCommandCenter.ts",
  "src/ui/commandDispatch.ts",
  "src/ui/commandStatus.ts",
  "src/ui/options.ts",
  "src/ui/popup.ts",
  "src/ui/renderCommandCenter.ts",
  "src/ui/sidebar.ts",
  "src/ui/sidepanel.ts",
  "static/dx.css",
  "static/dx.svg",
  "static/options.html",
  "static/popup.html",
  "static/sidebar.html",
  "static/sidepanel.html"
];
export const vsCodePackageSourceInputs = [
  ".vscodeignore",
  "README.md",
  "package.json",
  "src/commands/commandCenter.ts",
  "src/commands/commandCenterDispatch.ts",
  "src/commands/commandIds.ts",
  "src/commands/listForgePackages.ts",
  "src/commands/openReceipts.ts",
  "src/commands/receiptActions.ts",
  "src/commands/registerCommands.ts",
  "src/commands/runDoctor.ts",
  "src/commands/runHostUiCommand.ts",
  "src/commands/runTrustedCommand.ts",
  "src/commands/searchIcons.ts",
  "src/commands/showBuildGraph.ts",
  "src/commands/showCheckEditorState.ts",
  "src/commands/showLatestCheckReceipt.ts",
  "src/commands/showStatus.ts",
  "src/dx/cli.ts",
  "src/dx/commandPlan.ts",
  "src/dx/configuration.ts",
  "src/dx/iconSearch.ts",
  "src/extension.ts"
];
export const zedPackageSourceInputs = [
  "Cargo.lock",
  "Cargo.toml",
  "README.md",
  "extension.toml",
  "src/command_plans.rs",
  "src/lib.rs"
];
const packageSourceInputConfigByAdapter = new Map([
  [
    "dx.affinity-content.bridge",
    {
      label: "Affinity content package",
      expectedRelativePaths: [
        "affinity-content-manifest.json",
        "src/contentPlans.ts",
        "src/importGuide.ts"
      ]
    }
  ],
  [
    "dx.blender.command-center",
    {
      label: "Blender package-output",
      expectedRelativePaths: ["__init__.py", "blender_manifest.toml"]
    }
  ],
  [
    "dx.browser.command-center",
    {
      label: "Browser package-output",
      expectedRelativePaths: browserPackageSourceInputs
    }
  ],
  [
    "dx.canva.command-center",
    {
      label: "Canva package-output",
      expectedRelativePaths: [
        "canva-app.json",
        "src/app.tsx",
        "src/commandPlans.ts",
        "src/messages.ts"
      ]
    }
  ],
  [
    "dx.figma.command-center",
    {
      label: "Figma package-output",
      expectedRelativePaths: [
        "manifest.json",
        "src/commandPlans.ts",
        "src/main.ts",
        "src/messages.ts",
        "ui.html"
      ]
    }
  ],
  [
    "dx.vscode.command-center",
    {
      label: "VS Code package-output",
      expectedRelativePaths: vsCodePackageSourceInputs
    }
  ],
  [
    "dx.zed.command-center",
    {
      label: "Zed package-output",
      expectedRelativePaths: zedPackageSourceInputs
    }
  ],
  [
    "dx.google-workspace.command-center",
    {
      label: "Google Workspace package-output",
      expectedRelativePaths: googleWorkspaceSourceInputs
    }
  ],
  [
    "dx.obsidian.command-center",
    {
      label: "Obsidian package-output",
      expectedRelativePaths: ["manifest.json", "src/dxCommandRunner.ts", "src/main.ts"]
    }
  ],
  [
    "dx.sketch.command-center",
    {
      label: "Sketch package-output",
      expectedRelativePaths: ["manifest.json", "src/commandPlans.ts", "src/index.ts", "src/messages.ts"]
    }
  ]
]);

export function readSourceInputProofs(sourceRoot: string, relativePaths: readonly string[]): SourceInputProof[] {
  return relativePaths
    .map((relativePath) => readSourceInputProof(sourceRoot, relativePath))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function hashSourceInputs(inputs: readonly SourceInputProof[]): string {
  const hash = createHash("sha256");

  for (const input of inputs) {
    hash.update(input.relativePath);
    hash.update("\0");
    hash.update(input.sha256);
    hash.update("\0");
    hash.update(String(input.bytes));
    hash.update("\n");
  }

  return hash.digest("hex");
}

export function classifyGoogleWorkspacePackageSourceInputWeakness(
  receipt: SourceInputProofReceipt
): string | undefined {
  return classifySourceInputProofWeakness(
    "Google Workspace package-output",
    receipt.sourceRoot,
    receipt.sourceInputs,
    receipt.sourceSha256,
    googleWorkspaceSourceInputs
  );
}

export function classifyPackageSourceInputWeakness(
  adapterId: string,
  receipt: SourceInputProofReceipt
): string | undefined {
  const officeSourceWeakness = officeSourceFolderByAdapter.has(adapterId)
    ? classifyOfficePackageSourceInputWeakness(adapterId, receipt)
    : undefined;

  if (officeSourceWeakness) {
    return officeSourceWeakness;
  }

  const config = packageSourceInputConfigByAdapter.get(adapterId);

  if (!config) {
    return undefined;
  }

  return classifySourceInputProofWeakness(
    config.label,
    receipt.sourceRoot,
    receipt.sourceInputs,
    receipt.sourceSha256,
    config.expectedRelativePaths
  );
}

export function classifyOfficePackageSourceInputWeakness(
  adapterId: string,
  receipt: SourceInputProofReceipt
): string | undefined {
  const folder = officeSourceFolderByAdapter.get(adapterId);

  if (!folder) {
    return `Office package-output receipt is not linked to a known Office adapter: ${adapterId}`;
  }

  return classifySourceInputProofWeakness(
    "Office package-output",
    receipt.sourceRoot,
    receipt.sourceInputs,
    receipt.sourceSha256,
    [
      `${folder}/manifest.xml`,
      `${folder}/src/commandPlans.ts`,
      `${folder}/src/messages.ts`,
      `${folder}/src/taskpane.ts`,
      `${folder}/static/taskpane.html`,
      "shared/localServiceBoundary.ts"
    ]
  );
}

export function classifySourceInputProofWeakness(
  label: string,
  sourceRoot: unknown,
  sourceInputs: unknown,
  sourceSha256: unknown,
  expectedRelativePaths: readonly string[]
): string | undefined {
  if (typeof sourceRoot !== "string" || sourceRoot.trim() === "") {
    return `${label} source root is missing`;
  }

  if (!isSha256(sourceSha256)) {
    return `${label} source input aggregate hash is missing`;
  }

  if (!Array.isArray(sourceInputs) || sourceInputs.length === 0) {
    return `${label} source inputs are missing`;
  }

  let inputs: SourceInputProof[];

  try {
    inputs = sourceInputs.map((input) => readSourceInputRecord(label, input));
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const actualRelativePaths = inputs.map((input) => input.relativePath).sort();
  const expectedPaths = [...expectedRelativePaths].sort();

  if (!sameStringList(actualRelativePaths, expectedPaths)) {
    return `${label} source input list is incomplete`;
  }

  for (const input of inputs) {
    let current: SourceInputProof;

    try {
      current = readSourceInputProof(sourceRoot, input.relativePath);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }

    if (current.bytes !== input.bytes) {
      return `${label} source input size changed: ${input.relativePath}`;
    }

    if (current.sha256 !== input.sha256) {
      return `${label} source input hash changed: ${input.relativePath}`;
    }
  }

  const actualSha256 = hashSourceInputs(
    [...inputs].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  );

  return actualSha256 === sourceSha256 ? undefined : `${label} source input aggregate hash changed`;
}

function readSourceInputProof(sourceRoot: string, relativePath: string): SourceInputProof {
  const safeRelativePath = normalizeSafeRelativePath(relativePath, "source input relative path");
  const bytes = readFileSync(join(sourceRoot, ...safeRelativePath.split("/")));

  if (bytes.length <= 0) {
    throw new Error(`Source input file is empty: ${safeRelativePath}`);
  }

  return {
    relativePath: safeRelativePath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function readSourceInputRecord(label: string, value: unknown): SourceInputProof {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} source input proof must be an object`);
  }

  const input = value as Record<string, unknown>;

  return {
    relativePath: normalizeSafeRelativePath(input.relativePath, `${label} source input relative path`),
    bytes: expectPositiveInteger(input.bytes, `${label} source input bytes`),
    sha256: expectSha256(input.sha256, `${label} source input sha256`)
  };
}

function normalizeSafeRelativePath(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty relative path`);
  }

  const relativePath = value.split(sep).join("/");

  if (
    relativePath.includes(":") ||
    relativePath.includes("\\") ||
    relativePath.includes("://") ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("~") ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }

  return relativePath;
}

function expectPositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function expectSha256(value: unknown, label: string): string {
  if (!isSha256(value)) {
    throw new Error(`${label} must be a SHA-256 hex digest`);
  }

  return value;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
