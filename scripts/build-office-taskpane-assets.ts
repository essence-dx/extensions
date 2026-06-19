import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

export interface OfficeTaskpaneAssetBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface OfficeTaskpaneAssetBuildResult {
  adapterRoot: string;
  outputRoot: string;
  htmlPath: string;
  outputPath: string;
  sourceMapPath: string;
  manifestTaskpaneUrl: string;
  externalModules: string[];
  inputs: string[];
}

const officeAdapterFolders = ["dx-excel", "dx-powerpoint", "dx-word"] as const;

export async function buildOfficeTaskpaneAssets(
  options: OfficeTaskpaneAssetBuildOptions = {}
): Promise<OfficeTaskpaneAssetBuildResult> {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "office", "dx-excel")
  );
  const outputRoot = resolve(options.outputRoot ?? join(adapterRoot, "dist"));
  const htmlPath = join(outputRoot, "taskpane.html");
  const outputPath = join(outputRoot, "taskpane.js");

  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(
    htmlPath,
    renderHostedTaskpaneHtml(readFileSync(join(adapterRoot, "static", "taskpane.html"), "utf8"))
  );

  const result = await build({
    absWorkingDir: adapterRoot,
    entryPoints: ["src/taskpane.ts"],
    outfile: outputPath,
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2020",
    sourcemap: true,
    metafile: true,
    logLevel: "silent"
  });

  return {
    adapterRoot,
    outputRoot,
    htmlPath,
    outputPath,
    sourceMapPath: `${outputPath}.map`,
    manifestTaskpaneUrl: readManifestTaskpaneUrl(adapterRoot),
    externalModules: [],
    inputs: Object.keys(result.metafile.inputs).sort()
  };
}

if (isDirectRun()) {
  for (const adapterFolder of officeAdapterFolders) {
    const result = await buildOfficeTaskpaneAssets({
      adapterRoot: join(process.cwd(), "hosts", "office", adapterFolder)
    });

    console.log(`Office taskpane assets built: ${result.outputRoot}`);
  }
}

function renderHostedTaskpaneHtml(source: string): string {
  const sourceScript = '    <script type="module" src="../src/taskpane.ts"></script>';

  if (!source.includes(sourceScript)) {
    throw new Error("Office taskpane HTML does not contain the expected TypeScript script tag.");
  }

  return source.replace(sourceScript, '    <script src="./taskpane.js"></script>');
}

function readManifestTaskpaneUrl(adapterRoot: string): string {
  const manifest = readFileSync(join(adapterRoot, "manifest.xml"), "utf8");
  const match = /<SourceLocation DefaultValue="([^"]+\/taskpane\.html)"\/>/.exec(manifest);

  if (!match) {
    throw new Error("Office manifest does not declare a taskpane SourceLocation.");
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
