export interface DxReceiptsHost {
  isTrusted: boolean;
  workspaceRoot?: string;
  receiptsPath(workspaceRoot: string): string;
  receiptsDirectoryExistsAt(path: string): Promise<boolean>;
  revealPath(path: string): Promise<void>;
  copyText(text: string): Promise<void>;
  showWarning(message: string): void;
  showError(message: string): void;
  showInformation(message: string): void;
}

type ReceiptActionKind = "open" | "copy";

export async function openReceiptsFolder(host: DxReceiptsHost): Promise<void> {
  const receiptsPath = await resolveReceiptsPath(host, "open");
  if (!receiptsPath) {
    return;
  }

  try {
    await host.revealPath(receiptsPath);
  } catch (error) {
    host.showError(`Unable to open DX receipts folder: ${formatError(error)}`);
  }
}

export async function copyReceiptsPath(host: DxReceiptsHost): Promise<void> {
  const receiptsPath = await resolveReceiptsPath(host, "copy");
  if (!receiptsPath) {
    return;
  }

  try {
    await host.copyText(receiptsPath);
    host.showInformation("DX receipts path copied.");
  } catch (error) {
    host.showError(`Unable to copy DX receipts path: ${formatError(error)}`);
  }
}

async function resolveReceiptsPath(
  host: DxReceiptsHost,
  action: ReceiptActionKind
): Promise<string | undefined> {
  if (!host.workspaceRoot) {
    host.showWarning(workspaceWarning(action));
    return undefined;
  }

  if (!host.isTrusted) {
    host.showWarning(trustWarning(action));
    return undefined;
  }

  const receiptsPath = host.receiptsPath(host.workspaceRoot);
  if (!(await host.receiptsDirectoryExistsAt(receiptsPath))) {
    host.showWarning("No DX receipts folder found in this workspace.");
    return undefined;
  }

  return receiptsPath;
}

function workspaceWarning(action: ReceiptActionKind): string {
  if (action === "copy") {
    return "Open a workspace before copying DX receipts path.";
  }

  return "Open a workspace before viewing DX receipts.";
}

function trustWarning(action: ReceiptActionKind): string {
  if (action === "copy") {
    return "Trust this workspace before copying DX receipts path.";
  }

  return "Trust this workspace before viewing DX receipts.";
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "unknown error";
}
