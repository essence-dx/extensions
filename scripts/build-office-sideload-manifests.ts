import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface OfficeSideloadManifestBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
  baseUrl?: string;
}

export interface OfficeSideloadManifestBuildResult {
  adapterRoot: string;
  outputRoot: string;
  outputPath: string;
  baseUrl: string;
  taskpaneUrl: string;
  replacedOrigins: string[];
}

const officeAdapterFolders = ["dx-excel", "dx-powerpoint", "dx-word"] as const;
const inertOfficeOrigin = "https://dx-office.example.invalid";
const defaultSideloadBaseUrl = "https://localhost:3979";

export function buildOfficeSideloadManifestOutput(
  options: OfficeSideloadManifestBuildOptions = {}
): OfficeSideloadManifestBuildResult {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "office", "dx-excel")
  );
  const outputRoot = resolve(options.outputRoot ?? join(adapterRoot, "dist"));
  const baseUrl = normalizeOfficeSideloadBaseUrl(options.baseUrl ?? defaultSideloadBaseUrl);
  const sourceManifest = readFileSync(join(adapterRoot, "manifest.xml"), "utf8");

  if (!sourceManifest.includes(inertOfficeOrigin)) {
    throw new Error("Office manifest must use the inert DX Office placeholder origin.");
  }

  const manifest = sourceManifest.replaceAll(inertOfficeOrigin, baseUrl);
  assertSideloadManifestSafety(manifest);

  const taskpaneUrl = readTaskpaneUrl(manifest);
  const outputPath = join(outputRoot, "manifest.xml");

  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(outputPath, manifest);

  return {
    adapterRoot,
    outputRoot,
    outputPath,
    baseUrl,
    taskpaneUrl,
    replacedOrigins: [inertOfficeOrigin]
  };
}

if (isDirectRun()) {
  const baseUrl = process.env.DX_OFFICE_SIDELOAD_BASE_URL ?? defaultSideloadBaseUrl;

  for (const adapterFolder of officeAdapterFolders) {
    const result = buildOfficeSideloadManifestOutput({
      adapterRoot: join(process.cwd(), "hosts", "office", adapterFolder),
      baseUrl
    });

    console.log(`Office sideload manifest built: ${result.outputPath}`);
  }
}

function normalizeOfficeSideloadBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (parsed.protocol !== "https:") {
    throw new Error("Office sideload manifest base URL must use HTTPS.");
  }

  if (parsed.pathname !== "/") {
    throw new Error("Office sideload manifest base URL must not include a path.");
  }

  return parsed.origin;
}

function assertSideloadManifestSafety(manifest: string): void {
  if (manifest.includes(inertOfficeOrigin)) {
    throw new Error("Office sideload manifest still contains the inert placeholder origin.");
  }

  if (!/<Permissions>ReadDocument<\/Permissions>/.test(manifest)) {
    throw new Error("Office sideload manifest must keep ReadDocument permission.");
  }

  if (/<Permissions>(?:ReadWriteDocument|ReadAllDocument|WriteDocument)<\/Permissions>/.test(manifest)) {
    throw new Error("Office sideload manifest must not request write or broad read permissions.");
  }
}

function readTaskpaneUrl(manifest: string): string {
  const match = /<SourceLocation DefaultValue="([^"]+\/taskpane\.html)"\/>/.exec(manifest);

  if (!match) {
    throw new Error("Office sideload manifest does not declare a taskpane SourceLocation.");
  }

  return match[1];
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
