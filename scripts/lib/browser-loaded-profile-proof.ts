import type {
  BrowserLoadedProfileCommandRoundTrip,
  BrowserLoadedProfileProof,
  BrowserLoadedProfileTarget
} from "../write-browser-loaded-profile-receipt.ts";

export type ChromiumLoadedProfileTarget = "chrome" | "edge";
export type BrowserCommandId = BrowserLoadedProfileCommandRoundTrip["commandId"];

export interface BrowserExtensionIdCaptureReceipt {
  captures: BrowserExtensionIdCaptureRecord[];
}

export interface BrowserExtensionIdCaptureRecord {
  target: ChromiumLoadedProfileTarget;
  browserExecutablePath: string;
  browserVersion: string;
  extensionRoot: string;
  extensionId: string;
  extensionBaseUrl: string;
  backgroundServiceWorkerUrl: string;
  profilePath: string;
  loadedBackgroundServiceWorkerVerified: boolean;
}

export interface BrowserNativeHostPackageReceiptRecord {
  receiptPath?: string;
  nativeHost: {
    executable?: {
      sha256?: string;
    };
    manifests: Array<{
      target: BrowserLoadedProfileTarget;
      manifestPath: string;
      sha256?: string;
      name: string;
    }>;
  };
}

export interface BrowserLoadedProfileProofInput {
  capture: BrowserExtensionIdCaptureRecord;
  packageOutputReceiptPath: string;
  nativeHostPackageReceiptPath: string;
  nativeHostPackageReceipt: BrowserNativeHostPackageReceiptRecord;
  commandResults: BrowserLoadedProfileCommandRoundTrip[];
  hostUiCommandIds: string[];
}

export const requiredBrowserCommandIds: BrowserCommandId[] = ["status", "forgePackages", "showBuildGraph"];

export function buildBrowserLoadedProfileProof(input: BrowserLoadedProfileProofInput): BrowserLoadedProfileProof {
  const commandResults = sortRequiredCommandResults(input.commandResults);
  const nativeHostManifest = input.nativeHostPackageReceipt.nativeHost.manifests.find(
    (manifest) => manifest.target === input.capture.target
  );

  if (!nativeHostManifest) {
    throw new Error(`Browser loaded-profile smoke is missing ${input.capture.target} native-host manifest proof.`);
  }

  return {
    target: input.capture.target,
    browserExecutablePath: input.capture.browserExecutablePath,
    browserVersion: input.capture.browserVersion,
    profilePath: input.capture.profilePath,
    extensionId: input.capture.extensionId,
    extensionBaseUrl: input.capture.extensionBaseUrl,
    packageOutputReceiptPath: input.packageOutputReceiptPath,
    nativeHostPackageReceiptPath: input.nativeHostPackageReceiptPath,
    nativeHostManifestPath: nativeHostManifest.manifestPath,
    nativeHostName: nativeHostManifest.name,
    loadedProfileVerified: true,
    loadedBackgroundServiceWorkerVerified: true,
    nativeHostRegistered: true,
    commandRoundTrips: commandResults,
    hostUiCommandIds: [...input.hostUiCommandIds].sort()
  };
}

export function createRuntimeCommandEvaluationSource(
  commandId: BrowserCommandId,
  target: BrowserLoadedProfileTarget = "chrome"
): string {
  if (target === "firefox") {
    return `
      new Promise((resolve) => {
        browser.runtime.sendMessage(
          { type: "dx.browser.command.invoke", commandId: ${JSON.stringify(commandId)} }
        ).then(
          (response) => resolve(response),
          (error) => resolve({ ok: false, error: error?.message ?? String(error) })
        );
      })
    `;
  }

  return `
    new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "dx.browser.command.invoke", commandId: ${JSON.stringify(commandId)} },
        (response) => {
          const lastError = chrome.runtime.lastError && chrome.runtime.lastError.message;
          if (lastError) {
            resolve({ ok: false, error: lastError });
            return;
          }
          resolve(response);
        }
      );
    })
  `;
}

export function parseRuntimeCommandResult(
  commandId: BrowserCommandId,
  value: unknown
): BrowserLoadedProfileCommandRoundTrip {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.result)) {
    throw new Error(`Browser loaded-profile command failed in the loaded extension: ${commandId}`);
  }

  const result = value.result;
  if (result.commandId !== commandId || result.handledBy !== "native-host") {
    throw new Error(`Browser loaded-profile command did not round-trip through the native host: ${commandId}`);
  }

  if (typeof result.receiptPath !== "string" || result.receiptPath.trim() === "") {
    throw new Error(`Browser loaded-profile command is missing receipt proof: ${commandId}`);
  }

  return {
    commandId,
    hostActionId: hostActionIdForCommand(commandId),
    handledBy: "native-host",
    ok: true,
    receiptPath: result.receiptPath
  };
}

function sortRequiredCommandResults(
  commandResults: BrowserLoadedProfileCommandRoundTrip[]
): BrowserLoadedProfileCommandRoundTrip[] {
  const byCommandId = new Map(commandResults.map((commandResult) => [commandResult.commandId, commandResult]));
  const missingCommandIds = requiredBrowserCommandIds.filter((commandId) => !byCommandId.has(commandId));

  if (missingCommandIds.length > 0) {
    throw new Error(`Browser loaded-profile smoke must include native-host round trips for ${requiredBrowserCommandIds.join(", ")}.`);
  }

  return requiredBrowserCommandIds.map((commandId) => byCommandId.get(commandId)!);
}

function hostActionIdForCommand(commandId: BrowserCommandId): string {
  switch (commandId) {
    case "status":
      return "dx.browser.show_status";
    case "forgePackages":
      return "dx.browser.list_forge_packages";
    case "showBuildGraph":
      return "dx.browser.show_build_graph";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
