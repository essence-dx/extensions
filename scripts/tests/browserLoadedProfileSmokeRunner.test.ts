import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  buildBrowserLoadedProfileProof,
  createRuntimeCommandEvaluationSource
} from "../run-browser-loaded-profile-smoke.ts";

const workspaceRoot = mkdtempSync(join(tmpdir(), "dx-browser-loaded-profile-runner-"));

try {
  const packageOutputReceiptPath = writeWorkspaceFile(
    ".dx/receipts/extensions/dx.browser.command-center/package-output-latest.json",
    JSON.stringify({ receipt: "dx.extension.browser.package_output" }, null, 2)
  );
  const chromeManifestPath = writeWorkspaceFile(
    "native-host-package/chrome/dev.dx.browser.json",
    JSON.stringify({ name: "dev.dx.browser" }, null, 2)
  );
  const nativeHostPackageReceipt = {
    nativeHost: {
      executable: {
        sha256: "a".repeat(64)
      },
      manifests: [
        {
          target: "chrome",
          manifestPath: chromeManifestPath,
          sha256: "b".repeat(64),
          name: "dev.dx.browser"
        }
      ]
    }
  };
  const chromeCapture = {
    target: "chrome",
    browserExecutablePath: writeWorkspaceFile("tools/chrome.exe", "chrome executable\n"),
    browserVersion: "Chrome/148.0.7778.217",
    extensionRoot: join(workspaceRoot, "extension", "chrome"),
    profilePath: join(workspaceRoot, "profile", "chrome"),
    loadedBackgroundServiceWorkerVerified: true,
    extensionId: "abcdefghijklmnopabcdefghijklmnop",
    extensionBaseUrl: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/",
    backgroundServiceWorkerUrl: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/js/background/chromium.js"
  };

  const proof = buildBrowserLoadedProfileProof({
    capture: chromeCapture,
    packageOutputReceiptPath,
    nativeHostPackageReceiptPath: join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      "dx.browser.command-center",
      "native-host-release-package-latest.json"
    ),
    nativeHostPackageReceipt,
    commandResults: [
      commandResult("status", "dx.browser.show_status"),
      commandResult("forgePackages", "dx.browser.list_forge_packages"),
      commandResult("showBuildGraph", "dx.browser.show_build_graph")
    ],
    hostUiCommandIds: ["openReceipts"]
  });

  assert.deepEqual(proof, {
    target: "chrome",
    browserExecutablePath: chromeCapture.browserExecutablePath,
    browserVersion: chromeCapture.browserVersion,
    profilePath: chromeCapture.profilePath,
    extensionId: chromeCapture.extensionId,
    extensionBaseUrl: chromeCapture.extensionBaseUrl,
    packageOutputReceiptPath,
    nativeHostPackageReceiptPath: join(
      workspaceRoot,
      ".dx",
      "receipts",
      "extensions",
      "dx.browser.command-center",
      "native-host-release-package-latest.json"
    ),
    nativeHostManifestPath: chromeManifestPath,
    nativeHostName: "dev.dx.browser",
    loadedProfileVerified: true,
    loadedBackgroundServiceWorkerVerified: true,
    nativeHostRegistered: true,
    commandRoundTrips: [
      commandResult("status", "dx.browser.show_status"),
      commandResult("forgePackages", "dx.browser.list_forge_packages"),
      commandResult("showBuildGraph", "dx.browser.show_build_graph")
    ],
    hostUiCommandIds: ["openReceipts"]
  });

  assert.throws(
    () =>
      buildBrowserLoadedProfileProof({
        capture: chromeCapture,
        packageOutputReceiptPath,
        nativeHostPackageReceiptPath: join(
          workspaceRoot,
          ".dx",
          "receipts",
          "extensions",
          "dx.browser.command-center",
          "native-host-release-package-latest.json"
        ),
        nativeHostPackageReceipt,
        commandResults: [commandResult("status", "dx.browser.show_status")],
        hostUiCommandIds: []
      }),
    /must include native-host round trips for status, forgePackages, showBuildGraph/
  );

  const evaluationSource = createRuntimeCommandEvaluationSource("forgePackages");
  assert.match(evaluationSource, /chrome\.runtime\.sendMessage/);
  assert.match(evaluationSource, /dx\.browser\.command\.invoke/);
  assert.match(evaluationSource, /forgePackages/);

  const firefoxEvaluationSource = createRuntimeCommandEvaluationSource("forgePackages", "firefox");
  assert.match(firefoxEvaluationSource, /browser\.runtime\.sendMessage/);
  assert.doesNotMatch(firefoxEvaluationSource, /chrome\.runtime\.sendMessage/);
  assert.match(firefoxEvaluationSource, /dx\.browser\.command\.invoke/);
  assert.match(firefoxEvaluationSource, /forgePackages/);

  const wrapperSource = readFileSync(
    join(import.meta.dirname, "..", "smoke-browser-loaded-profile-j1.ps1"),
    "utf8"
  );
  assert.match(wrapperSource, /\[ValidateSet\("chrome", "edge", "firefox", "Chrome", "Edge", "Firefox"\)\]/);
  assert.match(wrapperSource, /Firefox loaded-profile smoke requires DX_BROWSER_LOADED_PROFILE_PROOF_JSON/);
  assert.match(
    wrapperSource,
    /Test-NativeHostPackageReceiptMatches[\s\S]*-NativeHostPath \$NativeHostPath/
  );
  assert.match(wrapperSource, /Test-NativeHostExecutableMatches/);
  assert.match(wrapperSource, /Test-NativeHostPackageOutputLinkCurrent/);
  assert.match(wrapperSource, /Test-NativeHostExtensionIdCaptureMatches/);
  assert.match(wrapperSource, /\[switch\] \$AllowBuild/);
  assert.match(wrapperSource, /DX_BROWSER_SMOKE_ALLOW_BUILD/);
  assert.match(wrapperSource, /Browser loaded-profile smoke requires an existing native-host executable/);
} finally {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

console.log("Browser loaded-profile smoke runner verified");

function commandResult(commandId: "status" | "forgePackages" | "showBuildGraph", hostActionId: string) {
  return {
    commandId,
    hostActionId,
    handledBy: "native-host" as const,
    ok: true as const,
    receiptPath: ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
  };
}

function writeWorkspaceFile(relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}
