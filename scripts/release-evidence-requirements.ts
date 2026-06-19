export interface EvidenceReceiptRequirement {
  kind: string;
  receiptPath: string;
}

export function parseEvidenceReceiptRequirement(value: string): EvidenceReceiptRequirement | undefined {
  const separatorIndex = value.indexOf("=");

  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return undefined;
  }

  return {
    kind: value.slice(0, separatorIndex).trim(),
    receiptPath: value.slice(separatorIndex + 1).trim()
  };
}

export function groupEvidenceReceiptRequirements(
  requirements: EvidenceReceiptRequirement[]
): Map<string, EvidenceReceiptRequirement[]> {
  const grouped = new Map<string, EvidenceReceiptRequirement[]>();

  for (const requirement of requirements) {
    const entries = grouped.get(requirement.kind) ?? [];
    entries.push(requirement);
    grouped.set(requirement.kind, entries);
  }

  return grouped;
}
