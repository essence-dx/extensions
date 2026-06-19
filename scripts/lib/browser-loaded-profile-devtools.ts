import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ChromiumExtensionLaunchInput {
  browserExecutablePath: string;
  extensionRoot: string;
}

export interface DevToolsTarget {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

interface DevToolsMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
}

interface RuntimeEvaluateResult {
  result?: {
    value?: unknown;
  };
  exceptionDetails?: {
    text?: string;
    exception?: {
      description?: string;
      value?: unknown;
    };
  };
}

export function launchChromiumWithExtension(input: ChromiumExtensionLaunchInput, profilePath: string): ChildProcess {
  return spawn(
    input.browserExecutablePath,
    [
      `--user-data-dir=${profilePath}`,
      `--disable-extensions-except=${input.extensionRoot}`,
      `--load-extension=${input.extensionRoot}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-sync",
      "about:blank"
    ],
    {
      detached: false,
      stdio: "ignore",
      windowsHide: true
    }
  );
}

export async function waitForDevToolsPort(profilePath: string, timeoutMs: number): Promise<number> {
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

  throw new Error("Browser loaded-profile smoke timed out waiting for DevToolsActivePort.");
}

export async function readBrowserVersion(port: number): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`);
  const version = await response.json() as { Browser?: unknown };

  if (typeof version.Browser !== "string" || version.Browser.trim() === "") {
    throw new Error("Browser loaded-profile smoke could not read browser version.");
  }

  return version.Browser;
}

export async function readDevToolsTargets(port: number): Promise<DevToolsTarget[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await response.json();

  if (!Array.isArray(targets)) {
    throw new Error("Browser loaded-profile smoke received an invalid DevTools target list.");
  }

  return targets as DevToolsTarget[];
}

export async function openDevToolsTarget(port: number, url: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT"
  });

  if (!response.ok) {
    throw new Error(`Browser loaded-profile smoke could not open extension page: ${response.status} ${response.statusText}`);
  }
}

export async function waitForServiceWorkerTarget(
  port: number,
  extensionId: string,
  timeoutMs: number
): Promise<DevToolsTarget> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const targets = await readDevToolsTargets(port);
    const serviceWorker = targets.find(
      (target) =>
        target.type === "service_worker" &&
        typeof target.url === "string" &&
        target.url.startsWith(`chrome-extension://${extensionId}/`)
    );

    if (serviceWorker) {
      return serviceWorker;
    }

    await delay(100);
  }

  throw new Error("Browser loaded-profile smoke timed out waiting for the extension service worker.");
}

export async function waitForExtensionPageTarget(
  port: number,
  extensionPageUrl: string,
  timeoutMs: number
): Promise<DevToolsTarget> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const targets = await readDevToolsTargets(port);
    const extensionPage = targets.find((target) => target.type === "page" && target.url === extensionPageUrl);

    if (extensionPage) {
      return extensionPage;
    }

    await delay(100);
  }

  throw new Error("Browser loaded-profile smoke timed out waiting for the extension options page.");
}

export class DevToolsClient {
  private nextId = 1;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  private readonly socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as DevToolsMessage;

      if (typeof message.id !== "number") {
        return;
      }

      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? "Chrome DevTools Protocol command failed."));
        return;
      }

      pending.resolve(message.result);
    });
  }

  static connect(url: string, timeoutMs: number): Promise<DevToolsClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("Browser loaded-profile smoke timed out connecting to extension DevTools."));
      }, timeoutMs);

      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve(new DevToolsClient(socket));
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Browser loaded-profile smoke could not connect to extension DevTools."));
      });
    });
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    }) as RuntimeEvaluateResult;

    if (result.exceptionDetails) {
      throw new Error(`Browser loaded-profile smoke evaluation failed: ${formatEvaluationException(result.exceptionDetails)}`);
    }

    return result.result?.value;
  }

  close(): void {
    this.socket.close();
  }
}

export function stopBrowser(process: ChildProcess): void {
  if (!process.killed) {
    process.kill();
  }
}

function formatEvaluationException(exceptionDetails: NonNullable<RuntimeEvaluateResult["exceptionDetails"]>): string {
  if (exceptionDetails.exception?.description) {
    return exceptionDetails.exception.description;
  }

  if (typeof exceptionDetails.exception?.value === "string" && exceptionDetails.exception.value.trim()) {
    return exceptionDetails.exception.value;
  }

  if (exceptionDetails.text) {
    return exceptionDetails.text;
  }

  return "unknown extension runtime exception";
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
