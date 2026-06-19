import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ZedExtensionBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
  compiledWasmPath?: string;
  cargoTarget?: string;
  targetRoot?: string;
}

export interface ZedExtensionBuildResult {
  adapterRoot: string;
  outputRoot: string;
  outputPath: string;
  manifestPath: string;
  cargoManifestPath: string;
  cargoTarget: string;
  targetRoot: string;
  compiledWasmPath: string;
  cargoArguments: string[];
}

const defaultCargoTarget = "wasm32-unknown-unknown";
const wasmHeader = [0, 97, 115, 109, 1, 0, 0, 0];

export function buildZedExtensionOutput(
  options: ZedExtensionBuildOptions = {}
): ZedExtensionBuildResult {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "zed", "dx-zed"));
  const outputRoot = resolve(options.outputRoot ?? adapterRoot);
  const cargoTarget = options.cargoTarget ?? defaultCargoTarget;
  const targetRoot = resolve(options.targetRoot ?? join(adapterRoot, "target"));
  const cargoManifestPath = join(adapterRoot, "Cargo.toml");
  const manifestPath = join(adapterRoot, "extension.toml");
  const compiledWasmPath = resolve(
    options.compiledWasmPath ?? defaultCompiledWasmPath(targetRoot, cargoTarget)
  );
  const outputPath = join(outputRoot, "extension.wasm");

  assertRequiredFile(cargoManifestPath, "Cargo manifest");
  assertRequiredFile(manifestPath, "Zed extension manifest");
  assertWasmFile(compiledWasmPath);

  mkdirSync(outputRoot, { recursive: true });
  copyFileSync(compiledWasmPath, outputPath);

  return {
    adapterRoot,
    outputRoot,
    outputPath,
    manifestPath,
    cargoManifestPath,
    cargoTarget,
    targetRoot,
    compiledWasmPath,
    cargoArguments: createZedCargoBuildArguments({
      cargoManifestPath,
      cargoTarget,
      targetRoot
    })
  };
}

export function createZedCargoBuildArguments(options: {
  cargoManifestPath: string;
  cargoTarget: string;
  targetRoot: string;
}): string[] {
  return [
    "build",
    "-j",
    "1",
    "--manifest-path",
    options.cargoManifestPath,
    "--target",
    options.cargoTarget,
    "--target-dir",
    options.targetRoot
  ];
}

if (isDirectRun()) {
  const result = buildZedExtensionOutput({
    compiledWasmPath: process.env.DX_ZED_COMPILED_WASM_PATH
  });
  console.log(`Zed WebAssembly output built: ${result.outputPath}`);
}

function defaultCompiledWasmPath(targetRoot: string, cargoTarget: string): string {
  return join(targetRoot, cargoTarget, "debug", "dx_command_center.wasm");
}

function assertRequiredFile(path: string, label: string): void {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} is missing: ${path}`);
  }
}

function assertWasmFile(path: string): void {
  assertRequiredFile(path, "Compiled Zed WebAssembly artifact");

  const source = readFileSync(path);
  const header = Array.from(source.subarray(0, wasmHeader.length));
  if (source.length < wasmHeader.length || !headersEqual(header, wasmHeader)) {
    throw new Error(`Compiled Zed artifact must be a WebAssembly module: ${basename(path)}`);
  }
}

function headersEqual(actual: number[], expected: number[]): boolean {
  return expected.every((value, index) => actual[index] === value);
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
