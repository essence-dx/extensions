import { Buffer } from "node:buffer";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface AffinityContentPackageBuildOptions {
  adapterRoot?: string;
  outputRoot?: string;
}

export interface AffinityContentPackageBuildResult {
  adapterRoot: string;
  outputRoot: string;
  manifestPath: string;
  swatchPath: string;
  metadataPath: string;
  guidePath: string;
  swatches: AffinitySwatch[];
  inputs: string[];
}

export interface AffinitySwatch {
  name: string;
  red: number;
  green: number;
  blue: number;
}

export const DX_AFFINITY_SWATCHES: AffinitySwatch[] = [
  { name: "DX Ink", red: 0.0902, green: 0.102, blue: 0.1216 },
  { name: "DX Surface", red: 0.9569, green: 0.9608, blue: 0.949 },
  { name: "DX Blueprint", red: 0.0706, green: 0.2784, blue: 0.5804 },
  { name: "DX Signal", red: 0.0, green: 0.4784, blue: 0.7843 },
  { name: "DX Accent", red: 0.9255, green: 0.2314, blue: 0.3804 },
  { name: "DX Success", red: 0.0471, green: 0.5176, blue: 0.3294 },
  { name: "DX Warning", red: 0.8941, green: 0.5961, blue: 0.102 },
  { name: "DX Danger", red: 0.7647, green: 0.1137, blue: 0.1647 }
];

const manifestFileName = "affinity-content-manifest.json";
const packageInputs = [manifestFileName, "src/importGuide.ts", "src/contentPlans.ts"];

export function buildAffinityContentPackage(
  options: AffinityContentPackageBuildOptions = {}
): AffinityContentPackageBuildResult {
  const adapterRoot = resolve(options.adapterRoot ?? join(process.cwd(), "hosts", "affinity", "dx-affinity-content"));
  const outputRoot = resolve(options.outputRoot ?? join(adapterRoot, "dist", "content-package"));
  const manifestPath = join(outputRoot, manifestFileName);
  const swatchPath = join(outputRoot, "swatches", "dx-core.ase");
  const metadataPath = join(outputRoot, "metadata", "dx-content-package.json");
  const guidePath = join(outputRoot, "README.md");

  mkdirSync(join(outputRoot, "swatches"), { recursive: true });
  mkdirSync(join(outputRoot, "metadata"), { recursive: true });

  copyFileSync(join(adapterRoot, manifestFileName), manifestPath);
  writeFileSync(swatchPath, encodeAdobeSwatchExchange(DX_AFFINITY_SWATCHES));
  writeFileSync(metadataPath, `${JSON.stringify(createPackageMetadata(DX_AFFINITY_SWATCHES), null, 2)}\n`);
  writeFileSync(guidePath, createPackageGuide(DX_AFFINITY_SWATCHES));

  return {
    adapterRoot,
    outputRoot,
    manifestPath,
    swatchPath,
    metadataPath,
    guidePath,
    swatches: [...DX_AFFINITY_SWATCHES],
    inputs: [...packageInputs]
  };
}

if (isDirectRun()) {
  const result = buildAffinityContentPackage();
  console.log(`Affinity content package built: ${result.outputRoot}`);
}

function encodeAdobeSwatchExchange(swatches: AffinitySwatch[]): Buffer {
  const blocks = swatches.map(encodeColorBlock);
  const header = Buffer.alloc(12);

  header.write("ASEF", 0, "ascii");
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(0, 6);
  header.writeUInt32BE(blocks.length, 8);

  return Buffer.concat([header, ...blocks]);
}

function encodeColorBlock(swatch: AffinitySwatch): Buffer {
  const payload = Buffer.concat([
    encodeUtf16BigEndianName(swatch.name),
    Buffer.from("RGB ", "ascii"),
    encodeBigEndianFloat(swatch.red),
    encodeBigEndianFloat(swatch.green),
    encodeBigEndianFloat(swatch.blue),
    encodeColorType()
  ]);
  const blockHeader = Buffer.alloc(6);

  blockHeader.writeUInt16BE(0x0001, 0);
  blockHeader.writeUInt32BE(payload.length, 2);

  return Buffer.concat([blockHeader, payload]);
}

function encodeUtf16BigEndianName(name: string): Buffer {
  const utf16LittleEndian = Buffer.from(`${name}\0`, "utf16le");
  const nameLength = Buffer.alloc(2);
  const utf16BigEndian = Buffer.alloc(utf16LittleEndian.length);

  nameLength.writeUInt16BE(utf16LittleEndian.length / 2, 0);

  for (let index = 0; index < utf16LittleEndian.length; index += 2) {
    utf16BigEndian[index] = utf16LittleEndian[index + 1];
    utf16BigEndian[index + 1] = utf16LittleEndian[index];
  }

  return Buffer.concat([nameLength, utf16BigEndian]);
}

function encodeBigEndianFloat(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeFloatBE(value, 0);
  return buffer;
}

function encodeColorType(): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16BE(0, 0);
  return buffer;
}

function createPackageMetadata(swatches: AffinitySwatch[]) {
  return {
    schema: "dx.affinity_content_package",
    manifestVersion: 1,
    adapterId: "dx.affinity-content.bridge",
    content: {
      swatches: swatches.map((swatch) => ({
        name: swatch.name,
        colorModel: "RGB",
        channels: [swatch.red, swatch.green, swatch.blue]
      }))
    },
    importTargets: ["Affinity Photo 2", "Affinity Designer 2", "Affinity Publisher 2"],
    importArtifacts: ["swatches/dx-core.ase"]
  };
}

function createPackageGuide(swatches: AffinitySwatch[]): string {
  const swatchList = swatches.map((swatch) => `- ${swatch.name}`).join("\n");

  return [
    "# DX Affinity Content Package",
    "",
    "Import `swatches/dx-core.ase` through the Affinity Swatches panel.",
    "The package is generated from source metadata and does not claim native Affinity plugin execution.",
    "",
    "Included swatches:",
    swatchList,
    ""
  ].join("\n");
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
