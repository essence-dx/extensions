import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const installScriptPath = join(packageRoot, "scripts", "install-native-host.sh");
const uninstallScriptPath = join(packageRoot, "scripts", "uninstall-native-host.sh");
const bashPath = findBash();
const tempRoot = mkdtempSync(join(tmpdir(), "dx-browser-native-host-shell-uninstall-"));

try {
  const nativeHostPath = join(tempRoot, "bin", "dx-browser-native-host");
  const installRoot = join(tempRoot, "native-host-manifests");
  const firefoxManifestRoot = join(tempRoot, "firefox-native-messaging-hosts");

  mkdirSync(join(tempRoot, "bin"), { recursive: true });
  writeFileSync(nativeHostPath, "");

  runBash(installScriptPath, [
    "--browser",
    "all",
    "--native-host-path",
    toBashPath(nativeHostPath),
    "--chrome-extension-id",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "--edge-extension-id",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "--install-root",
    toBashPath(installRoot),
    "--firefox-manifest-root",
    toBashPath(firefoxManifestRoot),
    "--manifest-only"
  ], tempRoot);

  const chromeManifestPath = join(installRoot, "chrome", "dev.dx.browser.json");
  const edgeManifestPath = join(installRoot, "edge", "dev.dx.browser.json");
  const firefoxManifestPath = join(firefoxManifestRoot, "dev.dx.browser.json");

  assert.equal(existsSync(chromeManifestPath), true, "Chrome proof manifest should exist before uninstall");
  assert.equal(existsSync(edgeManifestPath), true, "Edge proof manifest should exist before uninstall");
  assert.equal(existsSync(firefoxManifestPath), true, "Firefox proof manifest should exist before uninstall");

  runBash(uninstallScriptPath, [
    "--browser",
    "all",
    "--install-root",
    toBashPath(installRoot),
    "--firefox-manifest-root",
    toBashPath(firefoxManifestRoot),
    "--manifest-only"
  ], tempRoot);

  assert.equal(existsSync(chromeManifestPath), false, "Chrome proof manifest should be removed");
  assert.equal(existsSync(edgeManifestPath), false, "Edge proof manifest should be removed");
  assert.equal(existsSync(firefoxManifestPath), false, "Firefox proof manifest should be removed");
  assert.equal(existsSync(join(installRoot, "chrome")), true, "uninstall proof must not remove parent dirs");
  assert.equal(existsSync(join(installRoot, "edge")), true, "uninstall proof must not remove parent dirs");
  assert.equal(existsSync(firefoxManifestRoot), true, "uninstall proof must not remove parent dirs");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("browser native-host shell manifest uninstall proof verified");

function runBash(scriptPath, args, homeRoot) {
  execFileSync(
    bashPath,
    [toBashPath(scriptPath), ...args],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        HOME: toBashPath(join(homeRoot, "home")),
        MSYS2_ARG_CONV_EXCL: "*",
        MSYS_NO_PATHCONV: "1"
      },
      stdio: "pipe",
      windowsHide: true
    }
  );
}

function findBash() {
  const output = execFileSync("where.exe", ["bash"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
  const candidates = output.split(/\r?\n/).filter(Boolean);
  const gitBash = candidates.find((candidate) => candidate.includes("\\Git\\usr\\bin\\bash.exe"));
  const selected = gitBash ?? candidates[0];

  if (!selected || !existsSync(selected)) {
    throw new Error("bash is required for shell native-host uninstall proof");
  }

  return selected;
}

function toBashPath(path) {
  const normalizedPath = path.replace(/\\/g, "/");
  const driveMatch = /^([A-Za-z]):\/(.*)$/.exec(normalizedPath);

  if (!driveMatch) {
    return normalizedPath;
  }

  return `/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
}
