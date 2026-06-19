import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface StoredZipEntry {
  relativePath: string;
  sourcePath: string;
}

export interface StoredZipResult {
  path: string;
  bytes: number;
  sha256: string;
  entries: Array<{
    relativePath: string;
    bytes: number;
    sha256: string;
  }>;
}

interface CentralDirectoryRecord {
  header: Buffer;
  fileName: Buffer;
}

const utf8Flag = 0x0800;
const storedMethod = 0;
const dosTimeMidnight = 0;
const dosDate1980 = 0x0021;
let crc32Table: Uint32Array | undefined;

export function writeStoredZip(outputPath: string, entries: StoredZipEntry[]): StoredZipResult {
  if (entries.length === 0) {
    throw new Error("stored ZIP must contain at least one file");
  }

  if (entries.length > 0xffff) {
    throw new Error("stored ZIP entry count exceeds ZIP32 limits");
  }

  const normalizedEntries = entries
    .map((entry) => ({
      relativePath: normalizeZipPath(entry.relativePath),
      sourcePath: entry.sourcePath
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const fileParts: Buffer[] = [];
  const centralRecords: CentralDirectoryRecord[] = [];
  const manifestEntries: StoredZipResult["entries"] = [];
  let offset = 0;

  for (const entry of normalizedEntries) {
    const fileName = Buffer.from(entry.relativePath, "utf8");
    const data = readFileSync(entry.sourcePath);
    const crc = crc32(data);
    assertZip32Size(fileName.length, "stored ZIP file name");
    assertZip32Size(data.length, "stored ZIP file");
    assertZip32Size(offset, "stored ZIP offset");

    const localHeader = createLocalHeader(fileName, data.length, crc);
    fileParts.push(localHeader, fileName, data);
    centralRecords.push({
      header: createCentralDirectoryHeader(fileName, data.length, crc, offset),
      fileName
    });
    manifestEntries.push({
      relativePath: entry.relativePath,
      bytes: data.length,
      sha256: sha256(data)
    });
    offset += localHeader.length + fileName.length + data.length;
  }

  const centralDirectoryOffset = offset;
  const centralParts = centralRecords.flatMap((record) => [record.header, record.fileName]);
  const centralDirectorySize = centralParts.reduce((total, part) => total + part.length, 0);
  assertZip32Size(centralDirectoryOffset, "stored ZIP central directory offset");
  assertZip32Size(centralDirectorySize, "stored ZIP central directory size");

  const zipBytes = Buffer.concat([
    ...fileParts,
    ...centralParts,
    createEndOfCentralDirectory(centralRecords.length, centralDirectorySize, centralDirectoryOffset)
  ]);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, zipBytes);

  return {
    path: outputPath,
    bytes: zipBytes.length,
    sha256: sha256(zipBytes),
    entries: manifestEntries
  };
}

function createLocalHeader(fileName: Buffer, size: number, crc: number): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(utf8Flag, 6);
  header.writeUInt16LE(storedMethod, 8);
  header.writeUInt16LE(dosTimeMidnight, 10);
  header.writeUInt16LE(dosDate1980, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(fileName.length, 26);
  header.writeUInt16LE(0, 28);

  return header;
}

function createCentralDirectoryHeader(fileName: Buffer, size: number, crc: number, offset: number): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(utf8Flag, 8);
  header.writeUInt16LE(storedMethod, 10);
  header.writeUInt16LE(dosTimeMidnight, 12);
  header.writeUInt16LE(dosDate1980, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(fileName.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);

  return header;
}

function createEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Buffer {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralDirectorySize, 12);
  record.writeUInt32LE(centralDirectoryOffset, 16);
  record.writeUInt16LE(0, 20);

  return record;
}

function normalizeZipPath(relativePath: string): string {
  if (typeof relativePath !== "string") {
    throw new Error("stored ZIP entry path must be a string");
  }

  const normalized = relativePath.replaceAll("\\", "/");
  const parts = normalized.split("/");

  if (
    normalized.trim() === "" ||
    normalized.startsWith("/") ||
    normalized.startsWith("~") ||
    normalized.includes("://") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`stored ZIP entry path is unsafe: ${relativePath}`);
  }

  return normalized;
}

function assertZip32Size(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label} exceeds ZIP32 limits`);
  }
}

function crc32(bytes: Buffer): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getCrc32Table(): Uint32Array {
  if (crc32Table) {
    return crc32Table;
  }

  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  crc32Table = table;
  return table;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
