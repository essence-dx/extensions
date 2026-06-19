import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

export const nativeHostTestTimeoutMs = 60_000;

export class NativeHostProcessRuntime {
  binaryPath: string;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
  }

  async sendNativeMessage(_hostName: string, message: unknown): Promise<unknown> {
    const child = spawn(this.binaryPath, [], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    child.stdin.end(encodeNativeMessage(message));

    const exitCode = await waitForNativeHostExit(child);
    const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

    assert.equal(exitCode, 0, stderr || "native host exited with a non-zero status");
    assert.equal(stderr, "", "native host must not write stderr during smoke tests");

    return decodeNativeMessage(Buffer.concat(stdoutChunks));
  }
}

function encodeNativeMessage(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(body.byteLength, 0);
  return Buffer.concat([prefix, body]);
}

async function waitForNativeHostExit(child: ReturnType<typeof spawn>): Promise<number> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      once(child, "close").then(([exitCode]) => exitCode),
      once(child, "error").then(([error]) => {
        throw error;
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          child.kill();
          reject(new Error("native host did not exit after smoke request"));
        }, nativeHostTestTimeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function decodeNativeMessage(frame: Buffer): unknown {
  assert.ok(frame.byteLength >= 4, "native host response must include a length prefix");

  const bodyLength = frame.readUInt32LE(0);
  const bodyStart = 4;
  const bodyEnd = bodyStart + bodyLength;

  assert.equal(
    frame.byteLength,
    bodyEnd,
    "native host response must contain exactly one framed message"
  );

  return JSON.parse(frame.subarray(bodyStart, bodyEnd).toString("utf8"));
}
