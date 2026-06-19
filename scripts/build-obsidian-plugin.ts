import { mkdirSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

export interface ObsidianPluginBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface ObsidianPluginBuildResult {
  adapterRoot: string;
  outputPath: string;
  sourceMapPath: string;
  externalModules: string[];
  inputs: string[];
}

const obsidianExternalModule = "obsidian";

export async function buildObsidianPlugin(
  options: ObsidianPluginBuildOptions = {}
): Promise<ObsidianPluginBuildResult> {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "obsidian", "dx-command-center")
  );
  const outputRoot = resolve(options.outputRoot ?? adapterRoot);
  const outputPath = join(outputRoot, "main.js");

  mkdirSync(outputRoot, { recursive: true });

  const result = await build({
    absWorkingDir: adapterRoot,
    entryPoints: ["src/main.ts"],
    outfile: outputPath,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "es2022",
    sourcemap: true,
    external: [obsidianExternalModule],
    metafile: true,
    logLevel: "silent"
  });

  return {
    adapterRoot,
    outputPath,
    sourceMapPath: `${outputPath}.map`,
    externalModules: [obsidianExternalModule],
    inputs: Object.keys(result.metafile.inputs).sort()
  };
}

if (isDirectRun()) {
  const result = await buildObsidianPlugin();
  console.log(`Obsidian plugin built: ${result.outputPath}`);
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
