import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

export interface AdobeUxpPackageBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface AdobeUxpPackageBuildResult {
  adapterRoot: string;
  packageRoot: string;
  manifestPath: string;
  htmlPath: string;
  outputPath: string;
  sourceMapPath: string;
  externalModules: string[];
  inputs: string[];
}

const adobeUxpSourceInputs = ["src/messages.ts", "src/commandPlans.ts", "src/index.ts"] as const;
const adobeUxpAdapterFolders = [
  "dx-photoshop-uxp",
  "dx-premiere-pro-uxp",
  "dx-indesign-uxp"
] as const;

export async function buildAdobeUxpPackage(
  options: AdobeUxpPackageBuildOptions = {}
): Promise<AdobeUxpPackageBuildResult> {
  const adapterRoot = resolve(
    options.adapterRoot ?? join(process.cwd(), "hosts", "adobe", "dx-photoshop-uxp")
  );
  const outputRoot = resolve(options.outputRoot ?? adapterRoot);
  const packageRoot = join(outputRoot, "dist");
  const manifestPath = join(packageRoot, "manifest.json");
  const htmlPath = join(packageRoot, "index.html");
  const outputPath = join(packageRoot, "index.js");

  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(manifestPath, readFileSync(join(adapterRoot, "manifest.json"), "utf8"));
  writeFileSync(htmlPath, renderPackagedHtml(readFileSync(join(adapterRoot, "index.html"), "utf8")));

  await build({
    stdin: {
      contents: readOrderedScripts(adapterRoot),
      sourcefile: "index.ts",
      loader: "ts",
      resolveDir: adapterRoot
    },
    outfile: outputPath,
    bundle: false,
    platform: "neutral",
    format: "iife",
    target: "es2020",
    sourcemap: true,
    logLevel: "silent"
  });

  return {
    adapterRoot,
    packageRoot,
    manifestPath,
    htmlPath,
    outputPath,
    sourceMapPath: `${outputPath}.map`,
    externalModules: ["uxp"],
    inputs: [...adobeUxpSourceInputs]
  };
}

if (isDirectRun()) {
  for (const adapterFolder of adobeUxpAdapterFolders) {
    const result = await buildAdobeUxpPackage({
      adapterRoot: join(process.cwd(), "hosts", "adobe", adapterFolder)
    });

    console.log(`Adobe UXP package built: ${result.packageRoot}`);
  }
}

function readOrderedScripts(adapterRoot: string): string {
  return adobeUxpSourceInputs
    .map((relativePath) => readFileSync(join(adapterRoot, relativePath), "utf8"))
    .join("\n\n");
}

function renderPackagedHtml(source: string): string {
  const sourceScripts =
    '    <script src="./src/messages.ts"></script>\n' +
    '    <script src="./src/commandPlans.ts"></script>\n' +
    '    <script src="./src/index.ts"></script>';

  if (!source.includes(sourceScripts)) {
    throw new Error("Adobe UXP index.html does not contain the expected TypeScript script tags.");
  }

  return source.replace(sourceScripts, '    <script src="./index.js"></script>');
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
