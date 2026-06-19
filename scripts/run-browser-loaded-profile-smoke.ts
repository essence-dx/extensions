import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DevToolsClient,
  launchChromiumWithExtension,
  openDevToolsTarget,
  readBrowserVersion,
  stopBrowser,
  waitForDevToolsPort,
  waitForExtensionPageTarget,
  waitForServiceWorkerTarget,
  type DevToolsTarget
} from "./lib/browser-loaded-profile-devtools.ts";
import {
  buildBrowserLoadedProfileProof,
  createRuntimeCommandEvaluationSource,
  parseRuntimeCommandResult,
  requiredBrowserCommandIds,
  type BrowserCommandId,
  type BrowserExtensionIdCaptureReceipt,
  type BrowserExtensionIdCaptureRecord,
  type BrowserNativeHostPackageReceiptRecord,
  type ChromiumLoadedProfileTarget
} from "./lib/browser-loaded-profile-proof.ts";
import {
  type BrowserLoadedProfileCommandRoundTrip,
  type BrowserLoadedProfileProof,
  type BrowserLoadedProfileTarget,
  writeBrowserLoadedProfileReceipt
} from "./write-browser-loaded-profile-receipt.ts";

export { buildBrowserLoadedProfileProof, createRuntimeCommandEvaluationSource };

export interface BrowserLoadedProfileSmokeOptions {
  targets?: ChromiumLoadedProfileTarget[];
  timeoutMs?: number;
}

const adapterId = "dx.browser.command-center";
const defaultTargets: ChromiumLoadedProfileTarget[] = ["chrome", "edge"];

export async function runBrowserLoadedProfileSmoke(
  root = process.cwd(),
  options: BrowserLoadedProfileSmokeOptions = {}
): Promise<ReturnType<typeof writeBrowserLoadedProfileReceipt>[]> {
  const workspaceRoot = resolve(root);
  const targets = options.targets?.length ? uniqueTargets(options.targets) : defaultTargets;
  const extensionIdCaptureReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "extension-id-capture-latest.json"
  );
  const extensionIdCapture = readJson<BrowserExtensionIdCaptureReceipt>(
    extensionIdCaptureReceiptPath
  );
  const nativeHostPackageReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "native-host-release-package-latest.json"
  );
  const nativeHostPackageReceipt = readJson<BrowserNativeHostPackageReceiptRecord>(
    nativeHostPackageReceiptPath
  );
  const packageOutputReceiptPath = join(
    workspaceRoot,
    ".dx",
    "receipts",
    "extensions",
    adapterId,
    "package-output-latest.json"
  );
  const receipts: ReturnType<typeof writeBrowserLoadedProfileReceipt>[] = [];

  for (const target of targets) {
    const capture = extensionIdCapture.captures.find((entry) => entry.target === target);

    if (!capture) {
      throw new Error(`Browser loaded-profile smoke is missing ${target} extension ID capture.`);
    }

    receipts.push(
      writeBrowserLoadedProfileReceipt(workspaceRoot, {
        verificationCommand: `npm run smoke:browser-loaded-profile:j1 -- --target ${target}`,
        proof: await runLoadedProfileTarget({
          capture,
          packageOutputReceiptPath,
          nativeHostPackageReceiptPath,
          nativeHostPackageReceipt,
          timeoutMs: options.timeoutMs ?? 30000
        })
      })
    );
  }

  return receipts;
}

async function runLoadedProfileTarget(input: {
  capture: BrowserExtensionIdCaptureRecord;
  packageOutputReceiptPath: string;
  nativeHostPackageReceiptPath: string;
  nativeHostPackageReceipt: BrowserNativeHostPackageReceiptRecord;
  timeoutMs: number;
}): Promise<BrowserLoadedProfileProof> {
  const profilePath = join(tmpdir(), `dx-${input.capture.target}-loaded-profile-${Date.now().toString(36)}`);
  const extensionPageUrl = `${input.capture.extensionBaseUrl}static/options.html`;
  mkdirSync(profilePath, { recursive: true });

  const browser = launchChromiumWithExtension(input.capture, profilePath);
  try {
    const devToolsPort = await waitForDevToolsPort(profilePath, input.timeoutMs);
    const browserVersion = await readBrowserVersion(devToolsPort);
    const serviceWorker = await waitForServiceWorkerTarget(devToolsPort, input.capture.extensionId, input.timeoutMs);
    await openDevToolsTarget(devToolsPort, extensionPageUrl);
    const extensionPage = await waitForExtensionPageTarget(devToolsPort, extensionPageUrl, input.timeoutMs);
    const commandResults = await runExtensionPageCommands(
      extensionPage,
      input.capture.target,
      input.timeoutMs
    );

    return buildBrowserLoadedProfileProof({
      capture: {
        ...input.capture,
        browserVersion,
        profilePath,
        backgroundServiceWorkerUrl: serviceWorker.url ?? input.capture.backgroundServiceWorkerUrl,
        loadedBackgroundServiceWorkerVerified: true
      },
      packageOutputReceiptPath: input.packageOutputReceiptPath,
      nativeHostPackageReceiptPath: input.nativeHostPackageReceiptPath,
      nativeHostPackageReceipt: input.nativeHostPackageReceipt,
      commandResults,
      hostUiCommandIds: ["openReceipts"]
    });
  } finally {
    stopBrowser(browser);
  }
}

async function runExtensionPageCommands(
  extensionPage: DevToolsTarget,
  target: BrowserLoadedProfileTarget,
  timeoutMs: number
): Promise<BrowserLoadedProfileCommandRoundTrip[]> {
  if (!extensionPage.webSocketDebuggerUrl) {
    throw new Error("Browser loaded-profile smoke requires an extension-page DevTools WebSocket URL.");
  }

  const client = await DevToolsClient.connect(extensionPage.webSocketDebuggerUrl, timeoutMs);

  try {
    await client.send("Runtime.enable");
    await assertExtensionRuntimeAvailable(client);

    const results: BrowserLoadedProfileCommandRoundTrip[] = [];
    for (const commandId of requiredBrowserCommandIds) {
      results.push(parseRuntimeCommandResult(commandId, await evaluateBrowserCommand(client, commandId, target)));
    }

    return results;
  } finally {
    client.close();
  }
}

async function assertExtensionRuntimeAvailable(client: DevToolsClient): Promise<void> {
  const pageState = await client.evaluate(`
    ({
      href: globalThis.location?.href,
      title: globalThis.document?.title,
      readyState: globalThis.document?.readyState,
      chromeKeys: Object.keys(globalThis.chrome ?? {}),
      chromeRuntimeType: typeof globalThis.chrome?.runtime,
      browserRuntimeType: typeof globalThis.browser?.runtime
    })
  `);

  if (!isRecord(pageState) || pageState.chromeRuntimeType === "object" || pageState.browserRuntimeType === "object") {
    return;
  }

  throw new Error(`Browser loaded-profile extension page runtime is unavailable: ${JSON.stringify(pageState)}`);
}

function evaluateBrowserCommand(
  client: DevToolsClient,
  commandId: BrowserCommandId,
  target: BrowserLoadedProfileTarget
): Promise<unknown> {
  return client.evaluate(createRuntimeCommandEvaluationSource(commandId, target));
}

function readJson<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(`Browser loaded-profile smoke requires receipt: ${path}`);
  }

  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function parseCliOptions(args: string[]): BrowserLoadedProfileSmokeOptions {
  const options: BrowserLoadedProfileSmokeOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--target") {
      options.targets = [...(options.targets ?? []), parseTarget(args[++index])];
      continue;
    }

    if (argument === "--timeout-ms") {
      options.timeoutMs = Number(args[++index]);
      continue;
    }

    throw new Error(`Unsupported browser loaded-profile smoke argument: ${argument}`);
  }

  return options;
}

function parseTarget(value: string | undefined): ChromiumLoadedProfileTarget {
  if (value === "chrome" || value === "edge") {
    return value;
  }

  throw new Error(`Unsupported browser loaded-profile smoke target: ${value}`);
}

function uniqueTargets(targets: ChromiumLoadedProfileTarget[]): ChromiumLoadedProfileTarget[] {
  return [...new Set(targets)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

if (isDirectRun()) {
  try {
    const receipts = await runBrowserLoadedProfileSmoke(process.cwd(), parseCliOptions(process.argv.slice(2)));
    for (const receipt of receipts) {
      console.log(`${receipt.target} loaded-profile receipt written: ${receipt.receiptPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
