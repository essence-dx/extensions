import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const creativeNativePluginAdapters = [
  {
    adapterId: "dx.premiere-pro.command-center",
    commandIds: [
      "dx.premiere-pro.show_status",
      "dx.premiere-pro.search_media_assets",
      "dx.premiere-pro.show_receipts"
    ],
    folder: "dx-premiere-pro-uxp",
    host: "premiere-pro",
    hostApplication: "Premiere Pro",
    manifestId: "dx.premiere-pro.command-center.development",
    nativeArtifactName: "DxPremiereCommandCenter.prm",
    sdkName: "Premiere Pro SDK"
  },
  {
    adapterId: "dx.indesign.command-center",
    commandIds: [
      "dx.indesign.show_status",
      "dx.indesign.search_assets",
      "dx.indesign.show_receipts"
    ],
    folder: "dx-indesign-uxp",
    host: "indesign",
    hostApplication: "InDesign",
    manifestId: "dx.indesign.command-center.development",
    nativeArtifactName: "DxInDesignCommandCenter.idpln",
    sdkName: "InDesign SDK"
  }
] as const;

export type CreativeNativePluginFixtureAdapter = (typeof creativeNativePluginAdapters)[number];

export function writeCreativeNativePluginReleaseGateFixtures(workspaceRoot: string): void {
  writeWorkspaceFile(
    workspaceRoot,
    "registry/official-extensions.toml",
    `
schema = "dx.extensions.registry"
manifest_version = 1

${creativeNativePluginAdapters
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
name = "${adapter.adapterId}"
path = "hosts/adobe/${adapter.folder}"
manifest = "hosts/adobe/${adapter.folder}/dx.extension.toml"
status = "experimental"
professional_targets = ["adobe.${adapter.host}.uxp"]
`
  )
  .join("\n")}
`
  );

  for (const adapter of creativeNativePluginAdapters) {
    writeWorkspaceFile(
      workspaceRoot,
      `hosts/adobe/${adapter.folder}/dx.extension.toml`,
      `
[extension]
id = "${adapter.adapterId}"
`
    );
  }

  writeWorkspaceFile(
    workspaceRoot,
    "registry/release-evidence-gates.toml",
    `
schema = "dx.release_evidence_gates"
manifest_version = 1

${creativeNativePluginAdapters
  .map(
    (adapter) => `
[[extensions]]
id = "${adapter.adapterId}"
stage = "not-release-ready"
required_evidence = ["host_execution", "package_output", "native_or_hybrid_plugin", "signing", "checksum", "distribution_review"]
evidence_receipt_requirements = ["host_execution=.dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", "package_output=.dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", "native_or_hybrid_plugin=.dx/receipts/extensions/${adapter.adapterId}/native-plugin-latest.json", "signing=.dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", "checksum=.dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", "distribution_review=.dx/receipts/extensions/${adapter.adapterId}/creative-cloud-review-latest.json"]
evidence_receipts = [".dx/receipts/extensions/${adapter.adapterId}/loaded-host-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/package-output-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/native-plugin-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/signing-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/checksum-latest.json", ".dx/receipts/extensions/${adapter.adapterId}/creative-cloud-review-latest.json"]
next_release_proof = "Capture ${adapter.hostApplication} native plugin proof"
blocked_by = ["native plugin proof"]
`
  )
  .join("\n")}
`
  );
}

export function writeWorkspaceFile(workspaceRoot: string, relativePath: string, source: string): string {
  const absolutePath = join(workspaceRoot, ...relativePath.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
  return absolutePath;
}

export function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
