import { createHash } from "node:crypto";
import { inflateRawSync, gunzipSync } from "node:zlib";

import {
  type ReceiptRecord,
  hasSafePackageFileProof,
  readRecordArray
} from "./release-evidence-receipt-primitives.ts";

export type PackageArchiveFormat = "zip" | "gzip-tarball";

export interface PackageArchiveContentOptions {
  allowAdditionalEntries?: boolean;
  archiveFormat: PackageArchiveFormat;
  caseInsensitivePaths?: boolean;
  pathPrefixes?: string[];
}

export interface ArchiveEntryProof {
  relativePath: string;
  bytes: number;
  sha256: string;
}

export function classifyArchivePackageContentWeakness(
  artifactBytes: Buffer,
  payload: ReceiptRecord | undefined,
  archiveOptions: PackageArchiveFormat | PackageArchiveContentOptions
): string | undefined {
  const options = normalizeArchiveOptions(archiveOptions);
  const expectedFiles = readRecordArray(payload?.files);

  if (expectedFiles.length === 0 || !expectedFiles.every(hasSafePackageFileProof)) {
    return "archive is missing package payload file proof";
  }

  const parsedEntries = options.archiveFormat === "zip"
    ? parseZipEntries(artifactBytes)
    : parseGzipTarballEntries(artifactBytes);

  if (typeof parsedEntries === "string") {
    return parsedEntries;
  }

  if (!options.allowAdditionalEntries && parsedEntries.length !== expectedFiles.length) {
    return "archive entry count does not match package payload";
  }

  const entriesByPath = new Map(parsedEntries.map((entry) => [normalizeEntryPath(entry.relativePath, options), entry]));

  for (const expectedFile of expectedFiles) {
    const relativePath = String(expectedFile.relativePath);
    const archiveEntry = expectedArchivePaths(relativePath, options)
      .map((candidatePath) => entriesByPath.get(candidatePath))
      .find((entry): entry is ArchiveEntryProof => Boolean(entry));

    if (!archiveEntry) {
      return `archive does not contain package file proof: ${relativePath}`;
    }

    if (archiveEntry.bytes !== expectedFile.bytes || archiveEntry.sha256 !== expectedFile.sha256) {
      return `archive package file hash does not match package payload: ${relativePath}`;
    }
  }

  return undefined;
}

export function readZipArchiveEntryProofs(artifactBytes: Buffer): ArchiveEntryProof[] | string {
  return parseZipEntries(artifactBytes);
}

function normalizeArchiveOptions(
  archiveOptions: PackageArchiveFormat | PackageArchiveContentOptions
): PackageArchiveContentOptions {
  if (typeof archiveOptions === "string") {
    return {
      archiveFormat: archiveOptions,
      pathPrefixes: [""]
    };
  }

  return {
    ...archiveOptions,
    pathPrefixes: archiveOptions.pathPrefixes?.length ? archiveOptions.pathPrefixes : [""]
  };
}

function expectedArchivePaths(relativePath: string, options: PackageArchiveContentOptions): string[] {
  return (options.pathPrefixes ?? [""]).map((prefix) => normalizeEntryPath(`${prefix}${relativePath}`, options));
}

function normalizeEntryPath(relativePath: string, options: PackageArchiveContentOptions): string {
  return options.caseInsensitivePaths ? relativePath.toLowerCase() : relativePath;
}

function parseZipEntries(bytes: Buffer): ArchiveEntryProof[] | string {
  const centralDirectoryEntries = parseCentralDirectoryZipEntries(bytes);

  if (centralDirectoryEntries !== "archive is not readable package content") {
    return centralDirectoryEntries;
  }

  return parseLocalHeaderZipEntries(bytes);
}

function parseCentralDirectoryZipEntries(bytes: Buffer): ArchiveEntryProof[] | string {
  const entries: ArchiveEntryProof[] = [];
  const seenPaths = new Set<string>();
  const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(bytes);

  if (endOfCentralDirectoryOffset === undefined || endOfCentralDirectoryOffset + 22 > bytes.length) {
    return "archive is not readable package content";
  }

  const entryCount = bytes.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectorySize = bytes.readUInt32LE(endOfCentralDirectoryOffset + 12);
  const centralDirectoryOffset = bytes.readUInt32LE(endOfCentralDirectoryOffset + 16);
  let offset = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  if (entryCount <= 0 || centralDirectoryEnd > bytes.length || centralDirectoryEnd > endOfCentralDirectoryOffset) {
    return "archive is not readable package content";
  }

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (offset + 4 > bytes.length) {
      return "archive is not readable package content";
    }

    const signature = bytes.readUInt32LE(offset);

    if (signature !== 0x02014b50 || offset + 46 > bytes.length) {
      return "archive is not readable package content";
    }

    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const nextOffset = fileNameEnd + extraLength + commentLength;

    if (fileNameEnd > bytes.length || nextOffset > bytes.length || localHeaderOffset + 30 > bytes.length) {
      return "archive is not readable package content";
    }

    const relativePath = bytes.subarray(fileNameStart, fileNameEnd).toString("utf8");

    if (relativePath.endsWith("/")) {
      offset = nextOffset;
      continue;
    }

    const data = readZipEntryData(bytes, {
      compressedSize,
      flags,
      localHeaderOffset,
      method,
      uncompressedSize
    });

    if (typeof data === "string") {
      return data;
    }

    if (!isSafeArchiveEntryPath(relativePath)) {
      return "archive contains unsafe package entry path";
    }

    if (seenPaths.has(relativePath)) {
      return "archive contains duplicate package entry";
    }

    seenPaths.add(relativePath);
    entries.push({
      relativePath,
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex")
    });
    offset = nextOffset;
  }

  return entries.length > 0 ? entries : "archive is not readable package content";
}

function parseLocalHeaderZipEntries(bytes: Buffer): ArchiveEntryProof[] | string {
  const entries: ArchiveEntryProof[] = [];
  const seenPaths = new Set<string>();
  let offset = 0;

  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) {
      return "archive is not readable package content";
    }

    const signature = bytes.readUInt32LE(offset);

    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }

    if (signature !== 0x04034b50 || offset + 30 > bytes.length) {
      return "archive is not readable package content";
    }

    const flags = bytes.readUInt16LE(offset + 6);
    const method = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const uncompressedSize = bytes.readUInt32LE(offset + 22);
    const fileNameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const dataStart = fileNameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (fileNameEnd > bytes.length || dataEnd > bytes.length) {
      return "archive is not readable package content";
    }

    if ((flags & 0x0008) !== 0) {
      return "archive is not readable package content";
    }

    const relativePath = bytes.subarray(fileNameStart, fileNameEnd).toString("utf8");

    if (!isSafeArchiveEntryPath(relativePath)) {
      return "archive contains unsafe package entry path";
    }

    if (seenPaths.has(relativePath)) {
      return "archive contains duplicate package entry";
    }

    const data = readZipEntryPayload(bytes.subarray(dataStart, dataEnd), method, uncompressedSize);

    if (typeof data === "string") {
      return data;
    }

    seenPaths.add(relativePath);
    entries.push({
      relativePath,
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex")
    });
    offset = dataEnd;
  }

  return entries.length > 0 ? entries : "archive is not readable package content";
}

function findEndOfCentralDirectoryOffset(bytes: Buffer): number | undefined {
  const minimumOffset = Math.max(0, bytes.length - 0xffff - 22);

  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return undefined;
}

function readZipEntryData(
  bytes: Buffer,
  entry: {
    compressedSize: number;
    flags: number;
    localHeaderOffset: number;
    method: number;
    uncompressedSize: number;
  }
): Buffer | string {
  if ((entry.flags & 0x0001) !== 0) {
    return "archive is not readable package content";
  }

  const localSignature = bytes.readUInt32LE(entry.localHeaderOffset);

  if (localSignature !== 0x04034b50) {
    return "archive is not readable package content";
  }

  const localFileNameLength = bytes.readUInt16LE(entry.localHeaderOffset + 26);
  const localExtraLength = bytes.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + localFileNameLength + localExtraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > bytes.length) {
    return "archive is not readable package content";
  }

  return readZipEntryPayload(bytes.subarray(dataStart, dataEnd), entry.method, entry.uncompressedSize);
}

function readZipEntryPayload(
  payload: Buffer,
  method: number,
  expectedUncompressedSize: number
): Buffer | string {
  if (method === 0) {
    if (payload.length !== expectedUncompressedSize) {
      return "archive is not readable package content";
    }

    return payload;
  }

  if (method !== 8) {
    return "archive is not readable package content";
  }

  try {
    const inflated = inflateRawSync(payload);

    if (inflated.length !== expectedUncompressedSize) {
      return "archive is not readable package content";
    }

    return inflated;
  } catch {
    return "archive is not readable package content";
  }
}

function parseGzipTarballEntries(bytes: Buffer): ArchiveEntryProof[] | string {
  let tarBytes: Buffer;

  try {
    tarBytes = gunzipSync(bytes);
  } catch {
    return "archive is not readable package content";
  }

  const entries: ArchiveEntryProof[] = [];
  const seenPaths = new Set<string>();
  let offset = 0;

  while (offset + 512 <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + 512);

    if (header.every((byte) => byte === 0)) {
      break;
    }

    if (header[156] !== 0 && header[156] !== 0x30) {
      return "archive is not readable package content";
    }

    const relativePath = readTarString(header, 0, 100);
    const sizeSource = readTarString(header, 124, 12);

    if (!isSafeArchiveEntryPath(relativePath) || !/^[0-7]+$/.test(sizeSource)) {
      return "archive is not readable package content";
    }

    if (seenPaths.has(relativePath)) {
      return "archive contains duplicate package entry";
    }

    const size = Number.parseInt(sizeSource, 8);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (!Number.isSafeInteger(size) || size < 0 || dataEnd > tarBytes.length) {
      return "archive is not readable package content";
    }

    const data = tarBytes.subarray(dataStart, dataEnd);
    seenPaths.add(relativePath);
    entries.push({
      relativePath,
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex")
    });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries.length > 0 ? entries : "archive is not readable package content";
}

function readTarString(bytes: Buffer, offset: number, length: number): string {
  const field = bytes.subarray(offset, offset + length);
  const terminatorIndex = field.indexOf(0);
  const source = terminatorIndex === -1 ? field : field.subarray(0, terminatorIndex);

  return source.toString("ascii").trim();
}

function isSafeArchiveEntryPath(value: string): boolean {
  const parts = value.split("/");

  return (
    value.trim() !== "" &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !value.startsWith("~") &&
    !value.includes("://") &&
    parts.every((part) => part !== "" && part !== "." && part !== "..")
  );
}
