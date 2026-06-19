import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";

export interface GzipTarballEntry {
  relativePath: string;
  sourcePath: string;
}

export interface GzipTarballResult {
  path: string;
  bytes: number;
  sha256: string;
  entries: Array<{
    relativePath: string;
    bytes: number;
    sha256: string;
  }>;
}

const tarBlockSize = 512;
const regularFileType = "0".charCodeAt(0);

export function writeGzipTarball(outputPath: string, entries: GzipTarballEntry[]): GzipTarballResult {
  if (entries.length === 0) {
    throw new Error("gzip tarball must contain at least one file");
  }

  const normalizedEntries = entries
    .map((entry) => ({
      relativePath: normalizeTarPath(entry.relativePath),
      sourcePath: entry.sourcePath
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const parts: Buffer[] = [];
  const manifestEntries: GzipTarballResult["entries"] = [];

  for (const entry of normalizedEntries) {
    const data = readFileSync(entry.sourcePath);
    parts.push(createTarHeader(entry.relativePath, data.length), data, createPadding(data.length));
    manifestEntries.push({
      relativePath: entry.relativePath,
      bytes: data.length,
      sha256: sha256(data)
    });
  }

  parts.push(Buffer.alloc(tarBlockSize * 2));
  const tarBytes = Buffer.concat(parts);
  const gzipBytes = gzipSync(tarBytes, { level: 9, mtime: 0 });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, gzipBytes);

  return {
    path: outputPath,
    bytes: gzipBytes.length,
    sha256: sha256(gzipBytes),
    entries: manifestEntries
  };
}

function createTarHeader(relativePath: string, size: number): Buffer {
  const header = Buffer.alloc(tarBlockSize);
  writeAscii(header, 0, 100, relativePath);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = regularFileType;
  writeAscii(header, 257, 6, "ustar");
  writeAscii(header, 263, 2, "00");
  writeAscii(header, 265, 32, "dx");
  writeAscii(header, 297, 32, "dx");

  const checksum = header.reduce((total, byte) => total + byte, 0);
  const checksumSource = checksum.toString(8).padStart(6, "0");
  writeAscii(header, 148, 6, checksumSource);
  header[154] = 0;
  header[155] = 0x20;

  return header;
}

function createPadding(size: number): Buffer {
  const remainder = size % tarBlockSize;
  return remainder === 0 ? Buffer.alloc(0) : Buffer.alloc(tarBlockSize - remainder);
}

function normalizeTarPath(relativePath: string): string {
  if (typeof relativePath !== "string") {
    throw new Error("gzip tarball entry path must be a string");
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
    throw new Error(`gzip tarball entry path is unsafe: ${relativePath}`);
  }

  if (Buffer.byteLength(normalized, "utf8") > 100) {
    throw new Error(`gzip tarball entry path exceeds ustar name length: ${relativePath}`);
  }

  return normalized;
}

function writeAscii(buffer: Buffer, offset: number, length: number, value: string): void {
  const bytes = Buffer.from(value, "ascii");

  if (bytes.length > length) {
    throw new Error(`tar header value is too long: ${value}`);
  }

  bytes.copy(buffer, offset);
}

function writeOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`tar header octal value is invalid: ${value}`);
  }

  const source = value.toString(8).padStart(length - 1, "0");

  if (source.length > length - 1) {
    throw new Error(`tar header octal value is too large: ${value}`);
  }

  writeAscii(buffer, offset, length - 1, source);
  buffer[offset + length - 1] = 0;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
