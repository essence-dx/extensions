import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type BrowserExtensionIdCaptureTarget = "chrome" | "edge";

export interface BrowserExtensionIdCaptureOptions {
  allowPartial?: boolean;
  generatedAt?: Date | string;
  outputPath?: string;
  targets?: BrowserExtensionIdCaptureTarget[];
  timeoutMs?: number;
}

export interface BrowserExtensionIdCapture {
  target: BrowserExtensionIdCaptureTarget;
  browserExecutablePath: string;
  browserVersion: string;
  extensionRoot: string;
  extensionId: string;
  extensionBaseUrl: string;
  backgroundServiceWorkerUrl: string;
  profilePath: string;
  loadedBackgroundServiceWorkerVerified: true;
}

export interface BrowserExtensionIdCaptureReceipt {
  receipt: "dx.extension.browser.extension_id_capture";
  adapterId: "dx.browser.command-center";
  host: "browser";
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  captures: BrowserExtensionIdCapture[];
  nextProof: {
    nativeHostPackageCommand: string;
    loadedProfileProofCommand: string;
  };
  releaseClaims: {
    loadedChromeProfileVerified: false;
    loadedEdgeProfileVerified: false;
    loadedFirefoxProfileVerified: false;
    nativeHostReleasePackageVerified: false;
  };
}

export interface DevToolsTarget {
  type?: string;
  url?: string;
}

interface HostDiscoveryReceipt {
  tools?: Array<{ id?: string; found?: boolean; path?: string | null }>;
}

interface BrowserLaunchTarget {
  target: BrowserExtensionIdCaptureTarget;
  executablePath: string;
  extensionRoot: string;
  backgroundServiceWorkerPath: string;
}

interface BrowserLaunchProcess {
  diagnostics: string[];
  process: ChildProcess;
}

const adapterId = "dx.browser.command-center";
const defaultTargets: BrowserExtensionIdCaptureTarget[] = ["chrome", "edge"];
const targetToPackageDirectory: Record<BrowserExtensionIdCaptureTarget, string> = {
  chrome: "chromium",
  edge: "edge"
};

export async function captureBrowserExtensionIds(
  root = process.cwd(),
  options: BrowserExtensionIdCaptureOptions = {}
): Promise<BrowserExtensionIdCaptureReceipt> {
  const workspaceRoot = resolve(root);
  const requestedTargets = options.targets?.length ? uniqueTargets(options.targets) : defaultTargets;
  const receiptPath = resolve(
    options.outputPath ??
      join(workspaceRoot, ".dx", "receipts", "extensions", adapterId, "extension-id-capture-latest.json")
  );
  const launchTargets = readLaunchTargets(workspaceRoot, requestedTargets);
  const captures: BrowserExtensionIdCapture[] = [];

  for (const launchTarget of launchTargets) {
    captures.push(await captureBrowserExtensionId(launchTarget, options.timeoutMs ?? 20000));
  }

  const previousReceipt = readPreviousBrowserExtensionIdCaptureReceipt(receiptPath);
  const mergedCaptures = mergeBrowserExtensionIdCaptures(
    captures,
    previousReceipt?.captures ?? [],
    requestedTargets
  );

  if (options.allowPartial !== true) {
    assertCompleteBrowserExtensionIdCapture(mergedCaptures);
  }

  const receipt: BrowserExtensionIdCaptureReceipt = {
    receipt: "dx.extension.browser.extension_id_capture",
    adapterId,
    host: "browser",
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    verificationCommand: formatBrowserExtensionIdCaptureVerificationCommand(requestedTargets, options.timeoutMs),
    receiptPath,
    captures: mergedCaptures,
    nextProof: {
      nativeHostPackageCommand: createNativeHostPackageCommand(mergedCaptures),
      loadedProfileProofCommand: "npm run smoke:browser-loaded-profile:j1"
    },
    releaseClaims: {
      loadedChromeProfileVerified: false,
      loadedEdgeProfileVerified: false,
      loadedFirefoxProfileVerified: false,
      nativeHostReleasePackageVerified: false
    }
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

export function mergeBrowserExtensionIdCaptures(
  captures: BrowserExtensionIdCapture[],
  previousCaptures: BrowserExtensionIdCapture[],
  requestedTargets: BrowserExtensionIdCaptureTarget[]
): BrowserExtensionIdCapture[] {
  const captureByTarget = new Map<BrowserExtensionIdCaptureTarget, BrowserExtensionIdCapture>();
  const requestedTargetSet = new Set(requestedTargets);

  for (const capture of captures) {
    captureByTarget.set(capture.target, capture);
  }

  if (requestedTargetSet.size < defaultTargets.length) {
    for (const previousCapture of previousCaptures) {
      if (!requestedTargetSet.has(previousCapture.target) && !captureByTarget.has(previousCapture.target)) {
        captureByTarget.set(previousCapture.target, previousCapture);
      }
    }
  }

  return [...captureByTarget.values()].sort((left, right) => left.target.localeCompare(right.target));
}

export function assertCompleteBrowserExtensionIdCapture(captures: BrowserExtensionIdCapture[]): void {
  const capturedTargets = new Set(captures.map((capture) => capture.target));
  const missingTargets = defaultTargets.filter((target) => !capturedTargets.has(target));

  if (missingTargets.length > 0) {
    throw new Error(
      `Browser extension ID capture requires captured Chrome and Edge extension IDs. Missing: ${missingTargets.join(", ")}. Use --allow-partial only for non-release diagnostic captures.`
    );
  }
}

export function formatBrowserExtensionIdCaptureVerificationCommand(
  targets: BrowserExtensionIdCaptureTarget[],
  timeoutMs?: number
): string {
  const uniqueRequestedTargets = uniqueTargets(targets);
  const capturesAllDefaultTargets = defaultTargets.every((target) => uniqueRequestedTargets.includes(target));

  const commandArguments: string[] = [];

  if (!(uniqueRequestedTargets.length === defaultTargets.length && capturesAllDefaultTargets)) {
    commandArguments.push(...uniqueRequestedTargets.flatMap((target) => ["--target", target]));
  }

  if (timeoutMs !== undefined) {
    commandArguments.push("--timeout-ms", timeoutMs.toString());
  }

  if (commandArguments.length === 0) {
    return "npm run capture:browser-extension-ids:j1";
  }

  return `npm run capture:browser-extension-ids:j1 -- ${commandArguments.join(" ")}`;
}

export function findExtensionServiceWorkerTarget(
  target: BrowserExtensionIdCaptureTarget,
  devToolsTargets: DevToolsTarget[],
  backgroundServiceWorkerPath = "js/background/chromium.js"
): { extensionId: string; extensionBaseUrl: string; backgroundServiceWorkerUrl: string } {
  for (const devToolsTarget of devToolsTargets) {
    if (devToolsTarget.type !== "service_worker" || typeof devToolsTarget.url !== "string") {
      continue;
    }

    const extensionId = parseChromiumExtensionId(devToolsTarget.url);

    if (extensionId && hasExpectedServiceWorkerPath(devToolsTarget.url, backgroundServiceWorkerPath)) {
      return {
        extensionId,
        extensionBaseUrl: `chrome-extension://${extensionId}/`,
        backgroundServiceWorkerUrl: devToolsTarget.url
      };
    }
  }

  throw new Error(`Loaded ${target} profile did not expose the DX background service worker.`);
}

if (isDirectRun()) {
  try {
    const receipt = await captureBrowserExtensionIds(process.cwd(), parseCliOptions(process.argv.slice(2)));
    console.log(`Browser extension ID capture receipt written: ${receipt.receiptPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function readLaunchTargets(
  workspaceRoot: string,
  targets: BrowserExtensionIdCaptureTarget[]
): BrowserLaunchTarget[] {
  const discovery = readHostDiscoveryReceipt(workspaceRoot);

  return targets.map((target) => {
    const tool = discovery.tools?.find((entry) => entry.id === target);

    if (!tool?.found || !tool.path) {
      throw new Error(`Browser extension ID capture requires discovered ${target} executable proof.`);
    }

    const extensionRoot = join(
      workspaceRoot,
      "hosts",
      "browser",
      "dx-browser",
      "dist",
      "browser",
      targetToPackageDirectory[target]
    );

    if (!existsSync(extensionRoot)) {
      throw new Error(`Browser extension package output does not exist for ${target}: ${extensionRoot}`);
    }
    const backgroundServiceWorkerPath = readBackgroundServiceWorkerPath(extensionRoot);

    return {
      target,
      executablePath: tool.path,
      extensionRoot,
      backgroundServiceWorkerPath
    };
  });
}

function readPreviousBrowserExtensionIdCaptureReceipt(
  receiptPath: string
): BrowserExtensionIdCaptureReceipt | undefined {
  if (!existsSync(receiptPath)) {
    return undefined;
  }

  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as BrowserExtensionIdCaptureReceipt;

  if (
    receipt.receipt !== "dx.extension.browser.extension_id_capture" ||
    receipt.adapterId !== adapterId ||
    !Array.isArray(receipt.captures)
  ) {
    return undefined;
  }

  return receipt;
}

function readBackgroundServiceWorkerPath(extensionRoot: string): string {
  const manifestPath = join(extensionRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    background?: {
      service_worker?: unknown;
    };
  };
  const serviceWorkerPath = manifest.background?.service_worker;

  if (typeof serviceWorkerPath !== "string" || serviceWorkerPath.trim() === "") {
    throw new Error(`Browser extension manifest does not declare a background service worker: ${manifestPath}`);
  }

  return serviceWorkerPath;
}

function readHostDiscoveryReceipt(workspaceRoot: string): HostDiscoveryReceipt {
  const receiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "host-discovery-latest.json"
  );

  if (!existsSync(receiptPath)) {
    throw new Error("Browser extension ID capture requires platform host discovery receipt.");
  }

  return JSON.parse(readFileSync(receiptPath, "utf8")) as HostDiscoveryReceipt;
}

async function captureBrowserExtensionId(
  launchTarget: BrowserLaunchTarget,
  timeoutMs: number
): Promise<BrowserExtensionIdCapture> {
  const profilePath = join(tmpdir(), `dx-${launchTarget.target}-extension-id-${Date.now().toString(36)}`);
  mkdirSync(profilePath, { recursive: true });
  const browser = launchBrowser(launchTarget, profilePath);

  try {
    const devToolsPort = await waitForDevToolsPort(profilePath, timeoutMs);
    const browserVersion = await readBrowserVersion(devToolsPort);
    const serviceWorker = findExtensionServiceWorkerTarget(
      launchTarget.target,
      await waitForDevToolsTargets(devToolsPort, timeoutMs, launchTarget.backgroundServiceWorkerPath),
      launchTarget.backgroundServiceWorkerPath
    );

    return {
      target: launchTarget.target,
      browserExecutablePath: launchTarget.executablePath,
      browserVersion,
      extensionRoot: launchTarget.extensionRoot,
      profilePath,
      loadedBackgroundServiceWorkerVerified: true,
      ...serviceWorker
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${formatBrowserCaptureDiagnostics(browser.diagnostics)}`);
  } finally {
    stopBrowser(browser.process);
  }
}

function launchBrowser(launchTarget: BrowserLaunchTarget, profilePath: string): BrowserLaunchProcess {
  const diagnostics: string[] = [];
  const process = spawn(
    launchTarget.executablePath,
    [
      `--user-data-dir=${profilePath}`,
      `--disable-extensions-except=${launchTarget.extensionRoot}`,
      `--load-extension=${launchTarget.extensionRoot}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-sync",
      "--enable-logging=stderr",
      "--v=1",
      "about:blank"
    ],
    {
      detached: false,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    }
  );

  process.stderr?.on("data", (chunk) => {
    diagnostics.push(...chunk.toString("utf8").split(/\r?\n/).filter((line) => line.trim() !== ""));
  });

  return {
    diagnostics,
    process
  };
}

async function waitForDevToolsPort(profilePath: string, timeoutMs: number): Promise<number> {
  const portPath = join(profilePath, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (existsSync(portPath)) {
      const [portLine] = readFileSync(portPath, "utf8").split(/\r?\n/);
      const port = Number(portLine);

      if (Number.isInteger(port) && port > 0) {
        return port;
      }
    }

    await delay(100);
  }

  throw new Error("Browser extension ID capture timed out waiting for DevToolsActivePort.");
}

async function waitForDevToolsTargets(
  port: number,
  timeoutMs: number,
  backgroundServiceWorkerPath: string
): Promise<DevToolsTarget[]> {
  const deadline = Date.now() + timeoutMs;
  let lastTargets: DevToolsTarget[] = [];

  while (Date.now() < deadline) {
    const targets = await readDevToolsTargets(port);
    lastTargets = targets;

    if (
      targets.some(
        (target) =>
          target.type === "service_worker" &&
          parseChromiumExtensionId(target.url) &&
          hasExpectedServiceWorkerPath(target.url, backgroundServiceWorkerPath)
      )
    ) {
      return targets;
    }

    await delay(100);
  }

  throw new Error(
    `Browser extension ID capture timed out waiting for the extension service worker. Last DevTools targets: ${formatDevToolsTargets(lastTargets)}`
  );
}

async function readBrowserVersion(port: number): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`);
  const version = await response.json() as { Browser?: unknown };

  if (typeof version.Browser !== "string" || version.Browser.trim() === "") {
    throw new Error("Browser extension ID capture could not read browser version.");
  }

  return version.Browser;
}

async function readDevToolsTargets(port: number): Promise<DevToolsTarget[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await response.json();

  if (!Array.isArray(targets)) {
    throw new Error("Browser extension ID capture received an invalid DevTools target list.");
  }

  return targets as DevToolsTarget[];
}

function parseChromiumExtensionId(url: unknown): string | undefined {
  if (typeof url !== "string") {
    return undefined;
  }

  const match = /^chrome-extension:\/\/([a-p]{32})\//.exec(url);
  return match?.[1];
}

function hasExpectedServiceWorkerPath(url: string, backgroundServiceWorkerPath: string): boolean {
  try {
    return new URL(url).pathname === `/${backgroundServiceWorkerPath}`;
  } catch {
    return false;
  }
}

function stopBrowser(process: ChildProcess): void {
  if (!process.killed) {
    process.kill();
  }
}

function createNativeHostPackageCommand(captures: BrowserExtensionIdCapture[]): string {
  const chrome = captures.find((capture) => capture.target === "chrome")?.extensionId;
  const edge = captures.find((capture) => capture.target === "edge")?.extensionId;

  if (!chrome || !edge) {
    return "npm run package:browser-native-host:j1 -- -ChromeExtensionId <chrome-id> -EdgeExtensionId <edge-id>";
  }

  return `npm run package:browser-native-host:j1 -- -ChromeExtensionId ${chrome} -EdgeExtensionId ${edge}`;
}

export function formatBrowserCaptureDiagnostics(lines: string[]): string {
  const relevantLines = lines
    .filter((line) => /extension|manifest|load|allowed|error|warn/i.test(line))
    .filter((line) => !/segmentation_platform|OnGotModelScore|component_updater|signin|gcm/i.test(line))
    .slice(-20);

  return relevantLines.length > 0 ? ` Launch diagnostics: ${relevantLines.join(" | ")}` : "";
}

function formatDevToolsTargets(targets: DevToolsTarget[]): string {
  if (targets.length === 0) {
    return "none";
  }

  return targets
    .map((target) => `${target.type ?? "unknown"} ${target.url ?? "unknown-url"}`)
    .join("; ");
}

function parseCliOptions(args: string[]): BrowserExtensionIdCaptureOptions {
  const options: BrowserExtensionIdCaptureOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--target") {
      options.targets = [...(options.targets ?? []), parseTarget(args[++index])];
      continue;
    }

    if (argument === "--allow-partial") {
      options.allowPartial = true;
      continue;
    }

    if (argument === "--timeout-ms") {
      options.timeoutMs = Number(args[++index]);
      continue;
    }

    if (argument === "--output") {
      options.outputPath = args[++index];
      continue;
    }

    throw new Error(`Unsupported browser extension ID capture argument: ${argument}`);
  }

  return options;
}

function parseTarget(value: string | undefined): BrowserExtensionIdCaptureTarget {
  if (value === "chrome" || value === "edge") {
    return value;
  }

  throw new Error(`Unsupported browser extension ID capture target: ${value}`);
}

function uniqueTargets(targets: BrowserExtensionIdCaptureTarget[]): BrowserExtensionIdCaptureTarget[] {
  return [...new Set(targets)];
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
