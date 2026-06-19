import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
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
const installScriptPath = join(packageRoot, "scripts", "install-native-host.ps1");
const tempRoot = mkdtempSync(join(tmpdir(), "dx-browser-native-host-install-"));

try {
  const nativeHostPath = join(tempRoot, "bin", "dx-browser-native-host.exe");
  const installRoot = join(tempRoot, "native-host-manifests");
  const firefoxManifestRoot = join(tempRoot, "firefox-native-messaging-hosts");
  const chromeExtensionId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const edgeExtensionId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  mkdirSync(join(tempRoot, "bin"), { recursive: true });
  writeFileSync(nativeHostPath, "");

  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      installScriptPath,
      "-Browser",
      "All",
      "-NativeHostPath",
      nativeHostPath,
      "-ChromeExtensionId",
      chromeExtensionId,
      "-EdgeExtensionId",
      edgeExtensionId,
      "-InstallRoot",
      installRoot,
      "-FirefoxManifestRoot",
      firefoxManifestRoot,
      "-ManifestOnly"
    ],
    {
      cwd: packageRoot,
      stdio: "pipe",
      windowsHide: true
    }
  );

  assert.deepEqual(readJson(join(installRoot, "chrome", "dev.dx.browser.json")), {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: nativeHostPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${chromeExtensionId}/`]
  });

  assert.deepEqual(readJson(join(installRoot, "edge", "dev.dx.browser.json")), {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: nativeHostPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${edgeExtensionId}/`]
  });

  assert.deepEqual(readJson(join(firefoxManifestRoot, "dev.dx.browser.json")), {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: nativeHostPath,
    type: "stdio",
    allowed_extensions: ["dx-browser-command-center@dx.dev"]
  });
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("browser native-host manifest install proof verified");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
