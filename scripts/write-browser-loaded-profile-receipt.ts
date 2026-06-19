import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type BrowserLoadedProfileTarget = "chrome" | "edge" | "firefox";

export interface BrowserLoadedProfileReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: BrowserLoadedProfileProof;
}

export interface BrowserLoadedProfileProof {
  target: BrowserLoadedProfileTarget;
  browserExecutablePath: string;
  browserVersion: string;
  profilePath: string;
  extensionId: string;
  extensionBaseUrl: string;
  packageOutputReceiptPath: string;
  nativeHostPackageReceiptPath: string;
  nativeHostManifestPath: string;
  nativeHostName: string;
  loadedProfileVerified: boolean;
  loadedBackgroundServiceWorkerVerified: boolean;
  nativeHostRegistered: boolean;
  commandRoundTrips: BrowserLoadedProfileCommandRoundTrip[];
  hostUiCommandIds: string[];
}

export interface BrowserLoadedProfileCommandRoundTrip {
  commandId: "status" | "forgePackages" | "showBuildGraph";
  hostActionId: string;
  handledBy: "native-host";
  ok: true;
  receiptPath: string;
}

export interface BrowserLoadedProfileLinkedCommandRoundTrip extends BrowserLoadedProfileCommandRoundTrip {
  receiptSha256: string;
}

export interface BrowserLoadedProfileReceipt {
  receipt: "dx.extension.browser.loaded_profile";
  adapterId: "dx.browser.command-center";
  host: "browser";
  target: BrowserLoadedProfileTarget;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  browser: {
    executablePath: string;
    version: string;
    profileKind: "temporary";
    profilePath: string;
  };
  extension: {
    id: string;
    baseUrl: string;
  };
  packageOutput: {
    receiptPath: string;
    receiptSha256: string;
  };
  nativeHostPackage: {
    receiptPath: string;
    receiptSha256: string;
    target: BrowserLoadedProfileTarget;
    manifestPath: string;
    manifestSha256: string;
    executableSha256: string;
  };
  nativeHost: {
    name: string;
    manifestPath: string;
    registered: true;
  };
  loadedProfile: {
    backgroundServiceWorkerVerified: true;
    commandIds: Array<BrowserLoadedProfileCommandRoundTrip["commandId"]>;
    nativeHostRoundTrips: BrowserLoadedProfileLinkedCommandRoundTrip[];
    hostUiCommandIds: string[];
  };
  releaseClaims: {
    nativeHostReleasePackageVerified: false;
    signingVerified: false;
    releaseChecksumVerified: false;
    storeDistributionVerified: false;
  };
}

const adapterId = "dx.browser.command-center";
const receiptNames: Record<BrowserLoadedProfileTarget, string> = {
  chrome: "chrome-loaded-profile-latest.json",
  edge: "edge-loaded-profile-latest.json",
  firefox: "firefox-loaded-profile-latest.json"
};
const requiredNativeRoundTripCommandIds: Array<BrowserLoadedProfileCommandRoundTrip["commandId"]> = [
  "status",
  "forgePackages",
  "showBuildGraph"
];

export function writeBrowserLoadedProfileReceipt(
  root = process.cwd(),
  options: BrowserLoadedProfileReceiptOptions
): BrowserLoadedProfileReceipt {
  const workspaceRoot = resolve(root);
  const proof = validateProof(options.proof);
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    receiptNames[proof.target]
  );
  const packageOutputReceiptBytes = readFileSync(proof.packageOutputReceiptPath);
  const nativeHostPackage = readNativeHostPackageLink(proof);
  const nativeHostRoundTrips = linkNativeHostRoundTrips(workspaceRoot, proof.commandRoundTrips);
  const receipt: BrowserLoadedProfileReceipt = {
    receipt: "dx.extension.browser.loaded_profile",
    adapterId,
    host: "browser",
    target: proof.target,
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand:
      options.verificationCommand ?? `npm run smoke:browser-loaded-profile:j1 -- --target ${proof.target}`,
    receiptPath,
    browser: {
      executablePath: proof.browserExecutablePath,
      version: proof.browserVersion,
      profileKind: "temporary",
      profilePath: proof.profilePath
    },
    extension: {
      id: proof.extensionId,
      baseUrl: proof.extensionBaseUrl
    },
    packageOutput: {
      receiptPath: proof.packageOutputReceiptPath,
      receiptSha256: createHash("sha256").update(packageOutputReceiptBytes).digest("hex")
    },
    nativeHostPackage,
    nativeHost: {
      name: proof.nativeHostName,
      manifestPath: proof.nativeHostManifestPath,
      registered: true
    },
    loadedProfile: {
      backgroundServiceWorkerVerified: true,
      commandIds: [...requiredNativeRoundTripCommandIds],
      nativeHostRoundTrips,
      hostUiCommandIds: [...proof.hostUiCommandIds].sort()
    },
    releaseClaims: {
      nativeHostReleasePackageVerified: false,
      signingVerified: false,
      releaseChecksumVerified: false,
      storeDistributionVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

if (isDirectRun()) {
  console.error("Browser loaded-profile receipts must be written by a real browser smoke runner.");
  process.exit(1);
}

function validateProof(proof: BrowserLoadedProfileProof): BrowserLoadedProfileProof {
  assertAllowedTarget(proof.target);
  assertExistingAbsoluteFile(proof.browserExecutablePath, "browser executable");
  assertExistingAbsoluteFile(proof.packageOutputReceiptPath, "package-output receipt");
  assertExistingAbsoluteFile(proof.nativeHostPackageReceiptPath, "native-host package receipt");
  assertExistingAbsoluteFile(proof.nativeHostManifestPath, "native-host manifest");
  assertAbsolutePath(proof.profilePath, "browser profile path");
  assertNonEmpty(proof.browserVersion, "browser version");
  assertNonEmpty(proof.extensionId, "extension id");
  assertNonEmpty(proof.nativeHostName, "native-host name");

  if (!proof.extensionBaseUrl.startsWith(`${extensionUrlScheme(proof.target)}://`)) {
    throw new Error(`${proof.target} extension base URL must use the expected extension URL scheme.`);
  }

  if (!proof.loadedProfileVerified) {
    throw new Error("Browser loaded profile proof must come from a real launched browser profile.");
  }

  if (!proof.loadedBackgroundServiceWorkerVerified) {
    throw new Error("Browser loaded profile proof must verify the background service worker.");
  }

  if (!proof.nativeHostRegistered) {
    throw new Error("Browser loaded profile proof must verify native-host registration.");
  }

  assertRequiredNativeRoundTrips(proof.commandRoundTrips);

  return proof;
}

function readNativeHostPackageLink(
  proof: BrowserLoadedProfileProof
): BrowserLoadedProfileReceipt["nativeHostPackage"] {
  const receiptBytes = readFileSync(proof.nativeHostPackageReceiptPath);
  let receipt: unknown;

  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch {
    throw new Error("Browser loaded profile native-host package receipt is not readable JSON.");
  }

  if (
    !isRecord(receipt) ||
    receipt.receipt !== "dx.extension.browser.native_host_package" ||
    receipt.adapterId !== adapterId ||
    receipt.host !== "browser"
  ) {
    throw new Error("Browser loaded profile native-host package receipt is invalid.");
  }

  const nativeHost = isRecord(receipt.nativeHost) ? receipt.nativeHost : undefined;
  const executable = isRecord(nativeHost?.executable) ? nativeHost.executable : undefined;
  const manifests = Array.isArray(nativeHost?.manifests) ? nativeHost.manifests.filter(isRecord) : [];
  const manifest = manifests.find((entry) => entry.target === proof.target);

  if (
    !manifest ||
    manifest.manifestPath !== proof.nativeHostManifestPath ||
    manifest.name !== proof.nativeHostName ||
    !isSha256(manifest.sha256)
  ) {
    throw new Error(`Browser loaded profile native-host package receipt is missing ${proof.target} manifest linkage.`);
  }

  if (!isSha256(executable?.sha256)) {
    throw new Error("Browser loaded profile native-host package receipt is missing executable hash linkage.");
  }

  return {
    receiptPath: proof.nativeHostPackageReceiptPath,
    receiptSha256: createHash("sha256").update(receiptBytes).digest("hex"),
    target: proof.target,
    manifestPath: proof.nativeHostManifestPath,
    manifestSha256: manifest.sha256,
    executableSha256: executable.sha256
  };
}

function assertRequiredNativeRoundTrips(roundTrips: BrowserLoadedProfileCommandRoundTrip[]): void {
  const commandIds = new Set(roundTrips.map((roundTrip) => roundTrip.commandId));
  const missingCommandIds = requiredNativeRoundTripCommandIds.filter((commandId) => !commandIds.has(commandId));

  if (missingCommandIds.length > 0) {
    throw new Error(
      `Browser loaded profile proof must verify native-host round trips for ${requiredNativeRoundTripCommandIds.join(", ")}.`
    );
  }

  for (const roundTrip of roundTrips) {
    if (roundTrip.handledBy !== "native-host" || roundTrip.ok !== true) {
      throw new Error(`Browser loaded profile command must be a successful native-host round trip: ${roundTrip.commandId}`);
    }

    assertSafeAdapterReceiptPath(roundTrip.receiptPath, roundTrip.commandId);
  }
}

function linkNativeHostRoundTrips(
  workspaceRoot: string,
  roundTrips: BrowserLoadedProfileCommandRoundTrip[]
): BrowserLoadedProfileLinkedCommandRoundTrip[] {
  const byCommandId = new Map(roundTrips.map((roundTrip) => [roundTrip.commandId, roundTrip]));

  return requiredNativeRoundTripCommandIds.map((commandId) => {
    const roundTrip = byCommandId.get(commandId)!;
    const receiptBytes = readNativeHostRoundTripReceipt(workspaceRoot, roundTrip);

    return {
      ...roundTrip,
      receiptSha256: createHash("sha256").update(receiptBytes).digest("hex")
    };
  });
}

function readNativeHostRoundTripReceipt(
  workspaceRoot: string,
  roundTrip: BrowserLoadedProfileCommandRoundTrip
): Buffer {
  const absolutePath = join(workspaceRoot, ...roundTrip.receiptPath.split("/"));

  if (!existsSync(absolutePath)) {
    throw new Error(`Browser loaded profile command receipt does not exist: ${roundTrip.commandId}`);
  }

  const receiptBytes = readFileSync(absolutePath);
  let receipt: unknown;

  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch {
    throw new Error(`Browser loaded profile command receipt is not readable JSON: ${roundTrip.commandId}`);
  }

  if (
    !isRecord(receipt) ||
    receipt.receipt !== "dx.extension.host_action_index" ||
    receipt.adapterId !== adapterId ||
    receipt.host !== "browser"
  ) {
    throw new Error(`Browser loaded profile command receipt is not a browser host-action index receipt: ${roundTrip.commandId}`);
  }

  return receiptBytes;
}

function assertSafeAdapterReceiptPath(
  path: string,
  commandId: BrowserLoadedProfileCommandRoundTrip["commandId"]
): void {
  if (
    typeof path !== "string" ||
    path.trim() === "" ||
    path.includes("://") ||
    path.includes("\\") ||
    path.startsWith("/") ||
    path.startsWith("~") ||
    isAbsolute(path) ||
    path.split("/").includes("..") ||
    !path.startsWith(".dx/receipts/extensions/dx.browser.command-center/")
  ) {
    throw new Error(`Browser loaded profile command receipt path is outside the adapter receipt root: ${commandId}`);
  }
}

function assertAllowedTarget(target: string): asserts target is BrowserLoadedProfileTarget {
  if (!Object.hasOwn(receiptNames, target)) {
    throw new Error(`Unsupported browser loaded-profile target: ${target}`);
  }
}

function assertExistingAbsoluteFile(path: string, label: string): void {
  assertAbsolutePath(path, label);

  if (!existsSync(path)) {
    throw new Error(`Browser loaded profile ${label} does not exist: ${path}`);
  }
}

function assertAbsolutePath(path: string, label: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Browser loaded profile ${label} must be an absolute path.`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Browser loaded profile ${label} is required.`);
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extensionUrlScheme(target: BrowserLoadedProfileTarget): "chrome-extension" | "moz-extension" {
  return target === "firefox" ? "moz-extension" : "chrome-extension";
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
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
