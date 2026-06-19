import {
  DxBrowserPlatformApi,
  registerDxBrowserBackground
} from "./platform.ts";

const browserApi = (globalThis as typeof globalThis & { chrome?: DxBrowserPlatformApi })
  .chrome;

if (browserApi) {
  registerDxBrowserBackground(browserApi);
}
