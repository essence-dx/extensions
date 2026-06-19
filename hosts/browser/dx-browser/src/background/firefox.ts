import {
  DxBrowserPlatformApi,
  registerDxBrowserBackground
} from "./platform.ts";

const browserApi = (globalThis as typeof globalThis & { browser?: DxBrowserPlatformApi })
  .browser;

if (browserApi) {
  registerDxBrowserBackground(browserApi);
}
