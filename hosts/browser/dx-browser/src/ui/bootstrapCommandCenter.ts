import { bindCommandCenterActions } from "./commandDispatch.ts";
import { renderCommandStatus } from "./commandStatus.ts";
import { renderCommandCenter } from "./renderCommandCenter.ts";
import type { DxBrowserUiRuntime } from "./commandDispatch.ts";

type DxBrowserUiGlobal = typeof globalThis & {
  browser?: {
    runtime?: DxBrowserUiRuntime;
  };
  chrome?: {
    runtime?: DxBrowserUiRuntime;
  };
  confirm?: (message: string) => boolean;
  console?: {
    error?: (...data: unknown[]) => void;
  };
};

export function bootDxCommandCenter(title: string): void {
  const root = document.querySelector<HTMLElement>("[data-dx-browser-root]");
  if (!root) {
    return;
  }

  renderCommandCenter(root, title);

  const runtime = findRuntime();
  if (!runtime) {
    return;
  }

  bindCommandCenterActions(root, {
    runtime,
    confirmCommand(plan) {
      return readGlobal().confirm?.(
        `${plan.title} will contact the local DX native host.`
      ) === true;
    },
    reportError(error) {
      readGlobal().console?.error?.(error);
    },
    reportStatus(status) {
      renderCommandStatus(root, status);
    }
  });
}

function findRuntime(): DxBrowserUiRuntime | undefined {
  const currentGlobal = readGlobal();
  return currentGlobal.browser?.runtime ?? currentGlobal.chrome?.runtime;
}

function readGlobal(): DxBrowserUiGlobal {
  return globalThis as DxBrowserUiGlobal;
}
