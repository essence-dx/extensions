import { copyFileSync, mkdirSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface BlenderPackageOutputOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface BlenderPackageOutputResult {
  adapterRoot: string;
  outputRoot: string;
  manifestPath: string;
  addonPath: string;
  inputs: string[];
}

const blenderPackageInputs = ["__init__.py", "blender_manifest.toml"];

export function buildBlenderPackageOutput(
  options: BlenderPackageOutputOptions = {}
): BlenderPackageOutputResult {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "blender", "dx-blender"));
  const outputRoot = resolve(options.outputRoot ?? join(adapterRoot, "dist"));
  const manifestPath = join(outputRoot, "blender_manifest.toml");
  const addonPath = join(outputRoot, "__init__.py");

  mkdirSync(outputRoot, { recursive: true });
  copyFileSync(join(adapterRoot, "blender_manifest.toml"), manifestPath);
  copyFileSync(join(adapterRoot, "__init__.py"), addonPath);

  return {
    adapterRoot,
    outputRoot,
    manifestPath,
    addonPath,
    inputs: [...blenderPackageInputs]
  };
}

if (isDirectRun()) {
  const result = buildBlenderPackageOutput();
  console.log(`Blender package output built: ${result.outputRoot}`);
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
