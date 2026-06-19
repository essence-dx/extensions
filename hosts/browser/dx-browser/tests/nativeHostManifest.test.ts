import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const chromiumManifest = readJson("native-host/chromium/dev.dx.browser.template.json");
const firefoxManifest = readJson("native-host/firefox/dev.dx.browser.template.json");

assert.deepEqual(
  chromiumManifest,
  {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: "{{DX_NATIVE_HOST_PATH}}",
    type: "stdio",
    allowed_origins: ["chrome-extension://{{DX_BROWSER_EXTENSION_ID}}/"]
  },
  "Chromium native-host template should be narrow and tokenized"
);

assert.deepEqual(
  firefoxManifest,
  {
    name: "dev.dx.browser",
    description: "DX Browser native messaging host",
    path: "{{DX_NATIVE_HOST_PATH}}",
    type: "stdio",
    allowed_extensions: ["dx-browser-command-center@dx.dev"]
  },
  "Firefox native-host template should be narrow and tokenized"
);

for (const script of [
  "scripts/install-native-host.ps1",
  "scripts/uninstall-native-host.ps1",
  "scripts/install-native-host.sh",
  "scripts/uninstall-native-host.sh"
]) {
  assert.equal(existsSync(new URL(`../${script}`, import.meta.url)), true, `${script} should exist`);
}

const installScript = readText("scripts/install-native-host.ps1");
assert.match(installScript, /CmdletBinding\(SupportsShouldProcess = \$true\)/);
assert.match(installScript, /Set-StrictMode -Version Latest/);
assert.match(installScript, /HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts\\dev\.dx\.browser/);
assert.match(installScript, /HKCU:\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\dev\.dx\.browser/);
assert.match(installScript, /HKCU:\\Software\\Mozilla\\NativeMessagingHosts\\dev\.dx\.browser/);
assert.match(installScript, /\$ChromeExtensionId/);
assert.match(installScript, /\$EdgeExtensionId/);
assert.match(installScript, /\$FirefoxManifestRoot/);
assert.match(installScript, /\$ManifestOnly/);
assert.match(installScript, /Assert-ChromiumExtensionId/);
assert.match(installScript, /ShouldProcess/);
assert.match(installScript, /if \(\$ManifestOnly\)/);
assert.match(installScript, /WriteAllText/);
assert.match(installScript, /UTF8Encoding/);
assert.doesNotMatch(installScript, /ExtensionId = "{{DX_BROWSER_EXTENSION_ID}}"/);
assert.doesNotMatch(installScript, /HKLM:/, "install script must stay user-scoped");
assert.doesNotMatch(installScript, /-Recurse/, "install script must not use recursive writes or deletes");

const uninstallScript = readText("scripts/uninstall-native-host.ps1");
assert.match(uninstallScript, /CmdletBinding\(SupportsShouldProcess = \$true\)/);
assert.match(uninstallScript, /Set-StrictMode -Version Latest/);
assert.match(uninstallScript, /HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts\\dev\.dx\.browser/);
assert.match(uninstallScript, /HKCU:\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\dev\.dx\.browser/);
assert.match(uninstallScript, /HKCU:\\Software\\Mozilla\\NativeMessagingHosts\\dev\.dx\.browser/);
assert.match(uninstallScript, /ShouldProcess/);
assert.doesNotMatch(uninstallScript, /HKLM:/, "uninstall script must stay user-scoped");
assert.doesNotMatch(uninstallScript, /Remove-Item\s+.*-Recurse/, "uninstall script must avoid recursive deletes");

const shellInstallScript = readText("scripts/install-native-host.sh");
assert.match(shellInstallScript, /set -euo pipefail/);
assert.match(shellInstallScript, /Library\/Application Support\/Google\/Chrome\/NativeMessagingHosts/);
assert.match(shellInstallScript, /Library\/Application Support\/Microsoft Edge\/NativeMessagingHosts/);
assert.match(shellInstallScript, /\.config\/google-chrome\/NativeMessagingHosts/);
assert.match(shellInstallScript, /\.config\/microsoft-edge\/NativeMessagingHosts/);
assert.match(shellInstallScript, /\.mozilla\/native-messaging-hosts/);
assert.match(shellInstallScript, /--manifest-only/);
assert.match(shellInstallScript, /--install-root/);
assert.match(shellInstallScript, /--firefox-manifest-root/);
assert.match(shellInstallScript, /install_root\/edge\/\$host_name\.json/);
assert.doesNotMatch(shellInstallScript, /\bsudo\b/, "shell installer must stay user-scoped");
assert.doesNotMatch(shellInstallScript, /rm -rf/, "shell installer must not recursively delete");

const shellUninstallScript = readText("scripts/uninstall-native-host.sh");
assert.match(shellUninstallScript, /set -euo pipefail/);
assert.match(shellUninstallScript, /Library\/Application Support\/Microsoft Edge\/NativeMessagingHosts/);
assert.match(shellUninstallScript, /\.config\/microsoft-edge\/NativeMessagingHosts/);
assert.match(shellUninstallScript, /\.mozilla\/native-messaging-hosts/);
assert.match(shellUninstallScript, /--manifest-only/);
assert.match(shellUninstallScript, /--install-root/);
assert.match(shellUninstallScript, /--firefox-manifest-root/);
assert.match(shellUninstallScript, /install_root\/edge\/\$host_name\.json/);
assert.doesNotMatch(shellUninstallScript, /\bsudo\b/, "shell uninstaller must stay user-scoped");
assert.doesNotMatch(shellUninstallScript, /rm -rf/, "shell uninstaller must not recursively delete");

console.log("browser native-host manifests verified");

function readJson(path) {
  return JSON.parse(readText(path));
}

function readText(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
