import { normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type OperatorProofTemplateId,
  listOperatorProofTemplates,
  writeOperatorProofTemplateFile
} from "./lib/operator-proof-templates.ts";

interface WriteOperatorProofTemplateCliOptions {
  id?: string;
  output?: string;
  generatedAt?: string;
  list: boolean;
}

if (isDirectRun()) {
  try {
    const options = parseArguments(process.argv.slice(2));

    if (options.list) {
      for (const template of listOperatorProofTemplates()) {
        console.log(`${template.id}\t${template.adapterId}\t${template.receiptWriter.script}`);
      }
      process.exit(0);
    }

    if (!options.id || !options.output) {
      throw new Error("Usage: npm run write:operator-proof-template -- --id <template> --output <path>");
    }

    assertSupportedTemplateId(options.id);
    const result = writeOperatorProofTemplateFile({
      id: options.id,
      outputPath: resolve(options.output),
      generatedAt: options.generatedAt
    });

    console.log(`Operator proof template written: ${result.outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function parseArguments(args: string[]): WriteOperatorProofTemplateCliOptions {
  const options: WriteOperatorProofTemplateCliOptions = {
    list: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--list") {
      options.list = true;
      continue;
    }

    if (arg === "--id") {
      options.id = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--output") {
      options.output = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--generated-at") {
      options.generatedAt = readValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported operator proof template argument: ${arg}`);
  }

  return options;
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function assertSupportedTemplateId(value: string): asserts value is OperatorProofTemplateId {
  if (!listOperatorProofTemplates().some((template) => template.id === value)) {
    throw new Error(`Unsupported operator proof template: ${value}`);
  }
}

function isDirectRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return (
    normalize(resolve(process.argv[1])).toLowerCase() ===
    normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}
