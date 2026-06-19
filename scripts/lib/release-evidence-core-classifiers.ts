import { classifyHostExecutionWeakness } from "./release-evidence-host-execution-classifier.ts";
import { classifyPackageOutputWeakness } from "./release-evidence-package-output-classifier.ts";
import { classifySpecialProofWeakness } from "./release-evidence-special-proof-classifier.ts";

export function classifyCoreEvidenceWeakness(
  kind: string,
  receipt: Record<string, unknown> | undefined
): string | undefined {
  if (kind === "package_output" || kind === "content_package") {
    return classifyPackageOutputWeakness(kind, receipt);
  }

  if (kind === "host_execution") {
    return classifyHostExecutionWeakness(receipt);
  }

  const specialProofWeakness = classifySpecialProofWeakness(kind, receipt);

  if (specialProofWeakness) {
    return specialProofWeakness;
  }

  return undefined;
}
