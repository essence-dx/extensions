import { build } from "esbuild";
import { cp, mkdir, rm, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const outputRoot = join(packageRoot, "dist", "browser");
const staticRoot = join(packageRoot, "static");
const chromiumEntries = {
  "js/background/chromium.js": "src/background/chromium.ts",
  "js/ui/popup.js": "src/ui/popup.ts",
  "js/ui/sidepanel.js": "src/ui/sidepanel.ts",
  "js/ui/options.js": "src/ui/options.ts"
};

const targets = [
  {
    name: "chromium",
    manifest: "manifest.chromium.json",
    entries: chromiumEntries
  },
  {
    name: "edge",
    manifest: "manifest.edge.json",
    entries: chromiumEntries
  },
  {
    name: "firefox",
    manifest: "manifest.firefox.json",
    entries: {
      "js/background/firefox.js": "src/background/firefox.ts",
      "js/ui/popup.js": "src/ui/popup.ts",
      "js/ui/sidebar.js": "src/ui/sidebar.ts",
      "js/ui/options.js": "src/ui/options.ts"
    }
  }
];

await rm(outputRoot, { recursive: true, force: true });

for (const target of targets) {
  const targetRoot = join(outputRoot, target.name);

  await mkdir(targetRoot, { recursive: true });
  await copyFile(
    join(packageRoot, "manifests", target.manifest),
    join(targetRoot, "manifest.json")
  );
  await cp(staticRoot, join(targetRoot, "static"), { recursive: true });

  for (const [outfile, entryPoint] of Object.entries(target.entries)) {
    await build({
      absWorkingDir: packageRoot,
      bundle: true,
      entryPoints: [entryPoint],
      format: "esm",
      logLevel: "silent",
      minify: false,
      outfile: join(targetRoot, outfile),
      platform: "browser",
      sourcemap: true,
      target: ["chrome118", "firefox128"]
    });
  }
}

console.log("browser extension build artifacts prepared");
