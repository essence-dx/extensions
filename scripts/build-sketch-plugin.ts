import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

export interface SketchPluginBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface SketchPluginBuildResult {
  adapterRoot: string;
  bundleRoot: string;
  manifestPath: string;
  outputPath: string;
  sourceMapPath: string;
  externalModules: string[];
  inputs: string[];
}

const sketchBundleName = "dx-sketch.sketchplugin";
const sketchGeneratedScript = "index.js";

export async function buildSketchPlugin(
  options: SketchPluginBuildOptions = {}
): Promise<SketchPluginBuildResult> {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "sketch", "dx-sketch")
  );
  const outputRoot = resolve(options.outputRoot ?? adapterRoot);
  const bundleRoot = join(outputRoot, sketchBundleName);
  const sketchRoot = join(bundleRoot, "Contents", "Sketch");
  const outputPath = join(sketchRoot, sketchGeneratedScript);
  const manifestPath = join(sketchRoot, "manifest.json");

  mkdirSync(sketchRoot, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(readSketchManifest(adapterRoot), null, 2));

  const result = await build({
    absWorkingDir: adapterRoot,
    entryPoints: ["src/index.ts"],
    outfile: outputPath,
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "DXSketchCommandCenter",
    target: "es2020",
    sourcemap: true,
    metafile: true,
    logLevel: "silent"
  });

  return {
    adapterRoot,
    bundleRoot,
    manifestPath,
    outputPath,
    sourceMapPath: `${outputPath}.map`,
    externalModules: [],
    inputs: Object.keys(result.metafile.inputs).sort()
  };
}

if (isDirectRun()) {
  const result = await buildSketchPlugin();
  console.log(`Sketch plugin built: ${result.bundleRoot}`);
}

function readSketchManifest(adapterRoot: string): Record<string, unknown> {
  const manifest = JSON.parse(readFileSync(join(adapterRoot, "manifest.json"), "utf8"));
  const commands = Array.isArray(manifest.commands) ? manifest.commands : [];

  return {
    ...manifest,
    commands: commands.map((command) => ({
      ...command,
      script: sketchGeneratedScript
    }))
  };
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
