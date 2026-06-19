import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  dxBrowserNativeHostProtocol,
  dxBrowserNativeHostProtocolVersion
} = await import("../dist/js/runtime/protocol.js");

const manifest = readTomlLikeManifest("dx.extension.toml");

assert.equal(
  manifest.transport.protocol,
  dxBrowserNativeHostProtocol,
  "DX browser manifest protocol should match the runtime parser"
);

assert.equal(
  manifest.transport.framing,
  "native-messaging-json",
  "DX browser manifest should declare native messaging JSON framing"
);

assert.equal(
  Number(manifest.manifest_version),
  dxBrowserNativeHostProtocolVersion,
  "DX browser manifest version should match the initial protocol version"
);

assert.deepEqual(
  manifest.capabilityIds.sort(),
  [
    "browser.activeTab",
    "browser.sidePanel",
    "forge.read",
    "graph.read",
    "nativeMessaging.dx",
    "receipts.read"
  ],
  "DX browser manifest should declare the runtime capability boundary"
);

console.log("browser manifest protocol parity verified");

function readTomlLikeManifest(path) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const transport = {};
  const capabilityIds = [];
  let manifestVersion = "";
  let section = "";

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed === "[transport]") {
      section = "transport";
      continue;
    }

    if (trimmed === "[[capabilities]]") {
      section = "capability";
      continue;
    }

    if (trimmed.startsWith("[")) {
      section = "";
      continue;
    }

    const [key, rawValue] = trimmed.split("=", 2).map((part) => part.trim());
    const value = rawValue?.replace(/^"|"$/g, "");

    if (key === "manifest_version") {
      manifestVersion = value;
    }

    if (section === "transport" && key) {
      transport[key] = value;
    }

    if (section === "capability" && key === "id") {
      capabilityIds.push(value);
    }
  }

  return {
    manifest_version: manifestVersion,
    transport,
    capabilityIds
  };
}
