import assert from "node:assert/strict";

const {
  openReceiptsFolder,
  copyReceiptsPath
} = await import("../dist/commands/receiptActions.js");

await runScenario("open without workspace warns and does not reveal", async () => {
  const host = createReceiptHost({ workspaceRoot: undefined });

  await openReceiptsFolder(host);

  assert.deepEqual(host.warnings, ["Open a workspace before viewing DX receipts."]);
  assert.equal(host.revealedPath, undefined);
});

await runScenario("copy without trusted workspace warns and does not copy", async () => {
  const host = createReceiptHost({ trusted: false });

  await copyReceiptsPath(host);

  assert.deepEqual(host.warnings, ["Trust this workspace before copying DX receipts path."]);
  assert.equal(host.copiedText, undefined);
});

await runScenario("open missing receipts folder warns and does not reveal", async () => {
  const host = createReceiptHost({ receiptsDirectoryExists: false });

  await openReceiptsFolder(host);

  assert.deepEqual(host.warnings, ["No DX receipts folder found in this workspace."]);
  assert.equal(host.revealedPath, undefined);
});

await runScenario("open receipts folder reveals existing directory", async () => {
  const host = createReceiptHost({});

  await openReceiptsFolder(host);

  assert.equal(host.revealedPath, "G:/Workspace/.dx/receipts");
  assert.deepEqual(host.errors, []);
});

await runScenario("open receipts folder reports reveal failures", async () => {
  const host = createReceiptHost({ revealError: new Error("shell blocked") });

  await openReceiptsFolder(host);

  assert.deepEqual(host.errors, ["Unable to open DX receipts folder: shell blocked"]);
});

await runScenario("copy receipts path writes existing directory path", async () => {
  const host = createReceiptHost({});

  await copyReceiptsPath(host);

  assert.equal(host.copiedText, "G:/Workspace/.dx/receipts");
  assert.deepEqual(host.information, ["DX receipts path copied."]);
});

await runScenario("copy receipts path reports clipboard failures", async () => {
  const host = createReceiptHost({ clipboardError: new Error("clipboard denied") });

  await copyReceiptsPath(host);

  assert.deepEqual(host.errors, ["Unable to copy DX receipts path: clipboard denied"]);
});

console.log("vscode receipt actions verified");

async function runScenario(name, scenario) {
  try {
    await scenario();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function createReceiptHost(options) {
  const host = {
    warnings: [],
    errors: [],
    information: [],
    copiedText: undefined,
    revealedPath: undefined,
    isTrusted: options.trusted ?? true,
    workspaceRoot: Object.prototype.hasOwnProperty.call(options, "workspaceRoot")
      ? options.workspaceRoot
      : "G:/Workspace",
    receiptsDirectoryExists: options.receiptsDirectoryExists ?? true,
    receiptsPath(workspaceRoot) {
      return `${workspaceRoot}/.dx/receipts`;
    },
    async receiptsDirectoryExistsAt(_path) {
      return host.receiptsDirectoryExists;
    },
    async revealPath(path) {
      if (options.revealError) {
        throw options.revealError;
      }

      host.revealedPath = path;
    },
    async copyText(text) {
      if (options.clipboardError) {
        throw options.clipboardError;
      }

      host.copiedText = text;
    },
    showWarning(message) {
      host.warnings.push(message);
    },
    showError(message) {
      host.errors.push(message);
    },
    showInformation(message) {
      host.information.push(message);
    }
  };

  return host;
}
