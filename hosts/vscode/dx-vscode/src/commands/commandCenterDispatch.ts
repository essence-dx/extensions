import { resolveDxCommandPlan } from "../dx/commandPlan";
import type {
  DxCliCommandPlan,
  DxCommandPlan,
  DxHostUiCommandPlan
} from "../dx/commandPlan";

export interface DxCommandCenterDispatchDependencies {
  runCliCommand(plan: DxCliCommandPlan): Promise<void>;
  runHostUiCommand(plan: DxHostUiCommandPlan): Promise<void>;
  runInputCommand(plan: DxCommandPlan): Promise<void>;
}

export async function dispatchCommandCenterPlan(
  planId: string,
  dependencies: DxCommandCenterDispatchDependencies
): Promise<void> {
  const plan = resolveDxCommandPlan(planId);

  if (plan.input !== "none") {
    await dependencies.runInputCommand(plan);
    return;
  }

  if (plan.transport === "cli") {
    await dependencies.runCliCommand(plan);
    return;
  }

  await dependencies.runHostUiCommand(plan);
}
