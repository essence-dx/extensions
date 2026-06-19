import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const installScriptPath = join(packageRoot, "scripts", "install-native-host.sh");
const bashPath = findBash();
const tempRoot = mkdtempSync(join(tmpdir(), "dx-browser-native-host-shell-install-"));

try {
  const nativeHostPath = join(tempRoot, "bin", "dx-browser-native-host");
  const installRoot = join(tempRoot, "native-host-manifests");
  const firefoxManifestRoot = join(tempRoot, "firefox-native-messaging-hosts");
  const chromeExtensionId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const edgeExtensionId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  mkdirSync(join(tempRoot, "bin"), { recursive: true });
  writeFileSync(nativeHostPath, "");

  execFileSync(
    bashPath,
    [
      toBashPath(installScriptPath),
      "--browser",
      "all",
      "--native-host-path",
      toBashPath(nativeHostPath),
      "--chrome-extension-id",
      chromeExtensionId,
      "--edge-extension-id",
      edgeExtensionId,
      "--install-root",
      toBashPath(installRoot),
      "--firefox-manifest-root",
      toBashPath(firefoxManifestRoot),
      "--manifest-only"
    ],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        HOME: toBashPath(join(tempRoot, "home")),
        MSYS2_ARG_CONV_EXCL: "*",
        MSYS_NO_PATHCONV: "1"
      },
      stdio: "pipe",
      windowsHide: true
    }
  );

  assert.deepEqual(readJson(join(installRoot, "chrome", "dev.dx.browser.json")), {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: toBashPath(nativeHostPath),
    type: "stdio",
    allowed_origins: [`chrome-extension://${chromeExtensionId}/`]
  });

  assert.deepEqual(readJson(join(installRoot, "edge", "dev.dx.browser.json")), {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: toBashPath(nativeHostPath),
    type: "stdio",
    allowed_origins: [`chrome-extension://${edgeExtensionId}/`]
  });

  assert.deepEqual(readJson(join(firefoxManifestRoot, "dev.dx.browser.json")), {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: toBashPath(nativeHostPath),
    type: "stdio",
    allowed_extensions: ["dx-browser-command-center@dx.dev"]
  });
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("browser native-host shell manifest install proof verified");

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
    throw new Error("bash is required for shell native-host install proof");
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
