import { commandPlanForMessage, DX_SKETCH_COMMAND_PLANS } from "./commandPlans.ts";
import { DX_SKETCH_MESSAGES, messageTypeForMenuCommand } from "./messages.ts";
import type { DxSketchMessage } from "./messages.ts";

type SketchCommandContext = {
  command?: {
    identifier?: string;
  };
};

type DxSketchAvailabilityNotice = {
  message: string;
  operation: string;
  transport: string;
  query?: string;
};

function availabilityNoticeForMessage(
  message: DxSketchMessage,
  query?: string
): DxSketchAvailabilityNotice {
  const plan = commandPlanForMessage(message);
  const availabilityMessage = plan.requiresRuntimeProof
    ? "DX service connection is not configured for this host."
    : "DX receipt path is available in this host.";

  return {
    message: availabilityMessage,
    operation: plan.operation,
    transport: plan.transport,
    query
  };
}

function queryFromContext(context: unknown): string | undefined {
  if (!context || typeof context !== "object") {
    return undefined;
  }

  const commandContext = context as SketchCommandContext;
  return commandContext.command?.identifier;
}

export function showDxStatus(context?: unknown): DxSketchAvailabilityNotice {
  const menuMessage = messageTypeForMenuCommand(queryFromContext(context));
  return availabilityNoticeForMessage(menuMessage ?? DX_SKETCH_MESSAGES.showStatus);
}

export function searchDxAssets(context?: unknown): DxSketchAvailabilityNotice {
  return availabilityNoticeForMessage(DX_SKETCH_MESSAGES.searchAssets, queryFromContext(context));
}

export function showDxReceipts(context?: unknown): DxSketchAvailabilityNotice {
  return availabilityNoticeForMessage(DX_SKETCH_MESSAGES.showReceipts);
}

const sketchGlobal = globalThis as typeof globalThis & {
  DX_SKETCH_COMMAND_PLANS?: typeof DX_SKETCH_COMMAND_PLANS;
  showDxStatus?: typeof showDxStatus;
  searchDxAssets?: typeof searchDxAssets;
  showDxReceipts?: typeof showDxReceipts;
};

sketchGlobal.DX_SKETCH_COMMAND_PLANS = DX_SKETCH_COMMAND_PLANS;
sketchGlobal.showDxStatus = showDxStatus;
sketchGlobal.searchDxAssets = searchDxAssets;
sketchGlobal.showDxReceipts = showDxReceipts;
