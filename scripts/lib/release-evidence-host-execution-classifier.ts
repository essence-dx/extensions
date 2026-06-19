import {
  classifyBrowserLoadedProfileWeakness,
  classifyVsCodeLoadedHostWeakness
} from "./release-evidence-browser-host-classifier.ts";
import {
  classifyApplicationLoadedHostWeakness,
  classifyCreativeLoadedHostWeakness,
  classifyFigmaLoadedHostWeakness,
  classifyIdeGameEngineLoadedHostWeakness
} from "./release-evidence-loaded-application-host-classifier.ts";
import {
  classifyAffinityLoadedAppWeakness,
  classifyGoogleWorkspaceFileSmokeWeakness,
  classifyOfficeSideloadedHostWeakness
} from "./release-evidence-productivity-host-classifier.ts";
import type { ReceiptRecord } from "./release-evidence-receipt-primitives.ts";

export function classifyHostExecutionWeakness(receipt: ReceiptRecord | undefined): string | undefined {
  if (!receipt) {
    return "host-execution receipt is not a readable JSON object";
  }

  if (receipt.schema_version === "dx.extension.vscode_loaded_host_smoke.v1") {
    return classifyVsCodeLoadedHostWeakness(receipt);
  }

  switch (receipt.receipt) {
    case "dx.extension.affinity_content.loaded_app":
      return classifyAffinityLoadedAppWeakness(receipt);
    case "dx.extension.application.loaded_host":
      return classifyApplicationLoadedHostWeakness(receipt);
    case "dx.extension.browser.loaded_profile":
      return classifyBrowserLoadedProfileWeakness(receipt);
    case "dx.extension.creative.loaded_host":
      return classifyCreativeLoadedHostWeakness(receipt);
    case "dx.extension.figma.loaded_host":
      return classifyFigmaLoadedHostWeakness(receipt);
    case "dx.extension.google_workspace.workspace_file_smoke":
      return classifyGoogleWorkspaceFileSmokeWeakness(receipt);
    case "dx.extension.ide_game_engine.loaded_host":
      return classifyIdeGameEngineLoadedHostWeakness(receipt);
    case "dx.extension.office_taskpane.sideloaded_host":
      return classifyOfficeSideloadedHostWeakness(receipt);
    default:
      return "host-execution receipt is not a recognized loaded-host receipt";
  }
}
