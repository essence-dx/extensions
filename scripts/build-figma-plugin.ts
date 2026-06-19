import { mkdirSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

export interface FigmaPluginBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface FigmaPluginBuildResult {
  adapterRoot: string;
  outputPath: string;
  sourceMapPath: string;
  externalModules: string[];
  inputs: string[];
}

export async function buildFigmaPlugin(
  options: FigmaPluginBuildOptions = {}
): Promise<FigmaPluginBuildResult> {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "figma", "dx-figma")
  );
  const outputRoot = resolve(options.outputRoot ?? adapterRoot);
  const outputPath = join(outputRoot, "main.js");

  mkdirSync(outputRoot, { recursive: true });

  const result = await build({
    absWorkingDir: adapterRoot,
    entryPoints: ["src/main.ts"],
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
    outputPath,
    sourceMapPath: `${outputPath}.map`,
    externalModules: [],
    inputs: Object.keys(result.metafile.inputs).sort()
  };
}

if (isDirectRun()) {
  const result = await buildFigmaPlugin();
  console.log(`Figma plugin built: ${result.outputPath}`);
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
