import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const generatedDirectories = new Set([
  ".git",
  ".next",
  ".npm-cache",
  ".parcel-cache",
  ".tmp",
  ".turbo",
  ".vite",
  ".vscode-test",
  "build",
  "coverage",
  "dist",
  "gen",
  "generated",
  "node_modules",
  "out",
  "target",
  "vendor",
  "web-ext-artifacts"
]);
const javascriptSourceExtensions = [".js", ".jsx", ".mjs", ".cjs"];
const unsupportedTypescriptSourceExtensions = [".mts", ".cts"];
const packageMetadataFiles = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb"
]);
const approvedPackageMetadataPaths = new Set([
  "package.json",
  "package-lock.json",
  "hosts/browser/dx-browser/package.json",
  "hosts/unity/dx-unity-editor/package.json",
  "hosts/vscode/dx-vscode/package.json",
  "hosts/vscode/dx-vscode/tests/package.json"
]);

export function validateTypescriptSourceExtensions(root: string): string[] {
  const failures: string[] = [];

  for (const relativePath of findWorkspaceFiles(root)) {
    validatePackageMetadata(relativePath, failures);

    if (isGeneratedJavaScriptOutput(relativePath)) {
      failures.push(`${relativePath} is generated JavaScript output that must stay untracked and ignored`);
      continue;
    }

    if (hasGeneratedPathSegment(relativePath)) {
      continue;
    }

    if (javascriptSourceExtensions.some((extension) => relativePath.endsWith(extension))) {
      failures.push(`${relativePath} must be converted to TypeScript`);
      continue;
    }

    if (
      unsupportedTypescriptSourceExtensions.some((extension) =>
        relativePath.endsWith(extension)
      )
    ) {
      failures.push(`${relativePath} must use .ts or .tsx for TypeScript source`);
      continue;
    }

    if (relativePath.endsWith(".ts") || relativePath.endsWith(".tsx")) {
      validateTypescriptImports(root, relativePath, failures);
    }
  }

  return failures;
}

function validatePackageMetadata(relativePath: string, failures: string[]): void {
  const fileName = relativePath.split("/").at(-1);
  if (!fileName || !packageMetadataFiles.has(fileName)) {
    return;
  }

  if (!approvedPackageMetadataPaths.has(relativePath)) {
    failures.push(`${relativePath} is package metadata outside an approved npm package boundary`);
  }
}

if (isDirectRun()) {
  const failures = validateTypescriptSourceExtensions(process.cwd());

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("TypeScript source extensions verified");
}

function validateTypescriptImports(
  root: string,
  relativePath: string,
  failures: string[]
): void {
  const source = readFileSync(join(root, relativePath), "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const visit = (node: ts.Node): void => {
    const specifier = readImportSpecifier(node);

    if (
      specifier &&
      hasJavaScriptExtension(specifier) &&
      isRelativeImport(specifier) &&
      !isGeneratedOutputImport(specifier)
    ) {
      failures.push(
        `${relativePath} imports "${specifier}"; source imports must use the TypeScript extension`
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function readImportSpecifier(node: ts.Node): string | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }

  return undefined;
}

function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function isGeneratedOutputImport(specifier: string): boolean {
  const normalized = specifier.replaceAll("\\", "/");
  return normalized.includes("/dist/") || normalized.startsWith("dist/");
}

function hasJavaScriptExtension(specifier: string): boolean {
  return javascriptSourceExtensions.some((extension) => specifier.endsWith(extension));
}

function isGeneratedJavaScriptOutput(relativePath: string): boolean {
  return (
    hasGeneratedPathSegment(relativePath) &&
    javascriptSourceExtensions.some((extension) => relativePath.endsWith(extension))
  );
}

function findWorkspaceFiles(root: string, prefix = ""): string[] {
  const gitFiles = findGitWorkspaceFiles(root);
  if (gitFiles) {
    return gitFiles;
  }

  const files: string[] = [];

  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!generatedDirectories.has(entry.name)) {
        files.push(...findWorkspaceFiles(root, relativePath));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

function findGitWorkspaceFiles(root: string): string[] | undefined {
  try {
    const output = execFileSync(
      "git",
      ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true
      }
    );

    return output
      .split("\0")
      .filter(Boolean)
      .map((relativePath) => relativePath.replaceAll("\\", "/"));
  } catch {
    return undefined;
  }
}

function hasGeneratedPathSegment(relativePath: string): boolean {
  return relativePath
    .split("/")
    .some((segment) => generatedDirectories.has(segment));
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return (
    normalize(resolve(process.argv[1])).toLowerCase() ===
    normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}
