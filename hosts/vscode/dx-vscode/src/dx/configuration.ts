import * as vscode from "vscode";

export interface DxConfiguration {
  cliPath: string;
  commandTimeoutMs: number;
  autoRevealOutput: boolean;
}

export function readDxConfiguration(): DxConfiguration {
  const configuration = vscode.workspace.getConfiguration("dx");
  const timeoutSeconds = configuration.get<number>("commandTimeoutSeconds", 90);

  return {
    cliPath: configuration.get<string>("cliPath", "dx").trim() || "dx",
    commandTimeoutMs: Math.max(5, timeoutSeconds) * 1000,
    autoRevealOutput: configuration.get<boolean>("autoRevealOutput", true)
  };
}
