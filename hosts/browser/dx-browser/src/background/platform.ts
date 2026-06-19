import { createDxBrowserRuntimeMessageListener } from "./common.ts";
import { readBrowserExtensionOrigin } from "./messageSender.ts";
import { listDxBrowserCommandPlans } from "../runtime/commandPlans.ts";
import type { DxBrowserBackgroundDependencies } from "./common.ts";
import type { DxNativeMessagingRuntime } from "../runtime/nativeHostTransport.ts";
import type { DxBrowserHostContext } from "../runtime/protocol.ts";

export interface DxBrowserRuntimeApi {
  onInstalled?: {
    addListener(listener: () => void): void;
  };
  onMessage?: {
    addListener(listener: (message: unknown) => unknown): void;
  };
  getURL?: (path: string) => string;
  openOptionsPage?: () => Promise<void> | void;
}

export interface DxBrowserTabsApi {
  query(
    queryInfo: { active: true; currentWindow: true },
    callback?: (tabs: DxBrowserTab[]) => void
  ): Promise<DxBrowserTab[]> | DxBrowserTab[] | void;
}

export interface DxBrowserPlatformApi {
  runtime?: DxBrowserRuntimeApi;
  tabs?: DxBrowserTabsApi;
}

export interface DxBrowserTab {
  title?: string;
  url?: string;
}

export function registerDxBrowserBackground(api: DxBrowserPlatformApi): void {
  api.runtime?.onInstalled?.addListener(() => {
    listDxBrowserCommandPlans();
  });

  if (!api.runtime?.onMessage) {
    return;
  }

  api.runtime.onMessage.addListener(
    createDxBrowserRuntimeMessageListener(createDependencies(api))
  );
}

function createDependencies(
  api: DxBrowserPlatformApi
): DxBrowserBackgroundDependencies {
  return {
    nativeRuntime: api.runtime as unknown as DxNativeMessagingRuntime,
    hostUi: {
      async openReceipts() {
        await openReceiptsSurface(api);
      }
    },
    readActiveTabContext() {
      return readActiveTabContext(api);
    },
    extensionOrigin: readExtensionOrigin(api)
  };
}

function readExtensionOrigin(api: DxBrowserPlatformApi): string | undefined {
  return readBrowserExtensionOrigin(api.runtime?.getURL?.(""));
}

async function readActiveTabContext(
  api: DxBrowserPlatformApi
): Promise<DxBrowserHostContext> {
  const [tab] = await queryActiveTabs(api);
  const context: DxBrowserHostContext = {};

  if (typeof tab?.url === "string" && isHttpUrl(tab.url)) {
    context.activeTabUrl = tab.url;
  }

  if (typeof tab?.title === "string" && tab.title.trim()) {
    context.activeTabTitle = tab.title;
  }

  return context;
}

function queryActiveTabs(api: DxBrowserPlatformApi): Promise<DxBrowserTab[]> {
  if (!api.tabs?.query) {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    let callbackSettled = false;

    try {
      const result = api.tabs?.query(
        { active: true, currentWindow: true },
        (tabs) => {
          callbackSettled = true;
          resolve(tabs);
        }
      );

      if (isPromiseLike(result)) {
        result.then(resolve, reject);
      } else if (Array.isArray(result)) {
        resolve(result);
      } else if (result === undefined && !callbackSettled) {
        resolve([]);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function openReceiptsSurface(api: DxBrowserPlatformApi): Promise<void> {
  if (!api.runtime?.openOptionsPage) {
    throw new Error("DX browser receipts surface is not available.");
  }

  await api.runtime.openOptionsPage();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isPromiseLike(
  value: Promise<DxBrowserTab[]> | DxBrowserTab[] | void
): value is Promise<DxBrowserTab[]> {
  return !!value && typeof (value as Promise<DxBrowserTab[]>).then === "function";
}
