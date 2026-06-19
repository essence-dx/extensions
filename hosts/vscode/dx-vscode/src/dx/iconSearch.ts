import { DxCliCommandPlan, resolveDxCliCommandPlan } from "./commandPlan";

const fixedIconSearchArgs = ["--limit", "20"] as const;
const shellFreeIconQueryPattern = /^[A-Za-z0-9 _./-]+$/;

export function validateDxIconSearchQuery(value: string): string | undefined {
  const query = normalizeDxIconSearchQuery(value);

  if (!query) {
    return "Enter an icon name or keyword.";
  }

  if (query.length > 80) {
    return "Keep icon searches to 80 characters or fewer.";
  }

  if (!shellFreeIconQueryPattern.test(query)) {
    return "Use letters, numbers, spaces, dashes, underscores, dots, or slashes only.";
  }

  return undefined;
}

export function createDxIconSearchCommandPlan(query: string): DxCliCommandPlan {
  const validationError = validateDxIconSearchQuery(query);
  if (validationError) {
    throw new Error(validationError);
  }

  const plan = resolveDxCliCommandPlan("searchIcons");

  return {
    ...plan,
    input: "none",
    args: [
      ...plan.args,
      normalizeDxIconSearchQuery(query),
      ...fixedIconSearchArgs
    ]
  };
}

function normalizeDxIconSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
