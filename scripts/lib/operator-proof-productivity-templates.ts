import { googleWorkspaceOperatorProofTemplates } from "./operator-proof-google-workspace-templates.ts";
import { officeOperatorProofTemplates } from "./operator-proof-office-templates.ts";

export const productivityOperatorProofTemplates = [
  ...officeOperatorProofTemplates,
  ...googleWorkspaceOperatorProofTemplates
];
