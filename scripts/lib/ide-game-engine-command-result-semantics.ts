export type IdeGameEngineCommandStatus = "proof-blocked" | "visible";
export type IdeGameEngineCommandOperation = "dx.status" | "dx.assets.search" | "receipt.showPath";
export type IdeGameEngineCommandTransport = "host-ui" | "local-service";

export interface IdeGameEngineExpectedCommandResult {
  operation: IdeGameEngineCommandOperation;
  transport: IdeGameEngineCommandTransport;
  status: IdeGameEngineCommandStatus;
}

export function expectedIdeGameEngineCommandResultFor(
  commandId: string
): IdeGameEngineExpectedCommandResult | undefined {
  if (commandId.endsWith("show_status")) {
    return {
      operation: "dx.status",
      transport: "local-service",
      status: "proof-blocked"
    };
  }

  if (commandId.endsWith("search_assets")) {
    return {
      operation: "dx.assets.search",
      transport: "local-service",
      status: "proof-blocked"
    };
  }

  if (commandId.endsWith("show_receipts")) {
    return {
      operation: "receipt.showPath",
      transport: "host-ui",
      status: "visible"
    };
  }

  return undefined;
}
