import { basename } from "node:path";

import {
  type GzipTarballEntry,
  type GzipTarballResult,
  writeGzipTarball
} from "./gzip-tarball-writer.ts";
import { type StoredZipEntry, type StoredZipResult, writeStoredZip } from "./stored-zip-writer.ts";

export interface ZipPackageArtifactProof {
  path: string;
  fileName: string;
  bytes: number;
  sha256: string;
  zipHeaderVerified: true;
}

export interface GzipPackageArtifactProof {
  path: string;
  fileName: string;
  bytes: number;
  sha256: string;
  gzipHeaderVerified: true;
}

export function writeZipArtifactProof(
  outputPath: string,
  entries: StoredZipEntry[]
): ZipPackageArtifactProof {
  const artifact = writeStoredZip(outputPath, entries);

  return {
    ...toPackageArtifactProof(artifact),
    zipHeaderVerified: true
  };
}

export function writeGzipTarballArtifactProof(
  outputPath: string,
  entries: GzipTarballEntry[]
): GzipPackageArtifactProof {
  const artifact = writeGzipTarball(outputPath, entries);

  return {
    ...toPackageArtifactProof(artifact),
    gzipHeaderVerified: true
  };
}

function toPackageArtifactProof(artifact: StoredZipResult | GzipTarballResult) {
  return {
    path: artifact.path,
    fileName: basename(artifact.path),
    bytes: artifact.bytes,
    sha256: artifact.sha256
  };
}
