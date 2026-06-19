import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const schemaPath = join(root, "schemas", "dx.extension.manifest.schema.json");
const outputPath = join(root, "schemas", "types", "dx-extension-manifest.d.ts");

const typeNames = new Map([
  ["", "DxExtensionManifest"],
  ["extension", "DxExtensionIdentity"],
  ["compatibility", "DxExtensionCompatibility"],
  ["entrypoint", "DxExtensionEntrypoint"],
  ["transport", "DxExtensionTransportContract"],
  ["security", "DxExtensionSecurityPolicy"],
  ["capabilities[]", "DxExtensionCapability"],
  ["host_actions[]", "DxExtensionHostAction"],
  ["receipts[]", "DxExtensionReceiptContract"]
]);

const options = parseOptions(process.argv.slice(2));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const source = generateTypes(schema);

if (options.print) {
  process.stdout.write(source);
} else if (options.check) {
  checkGeneratedTypes(source);
} else {
  writeGeneratedTypes(source);
}

function generateTypes(rootSchema) {
  const interfaces = [];
  collectInterface(rootSchema, "", interfaces);

  return [
    "/*",
    " * Generated from schemas/dx.extension.manifest.schema.json.",
    " * Run `npm run generate:manifest-types` after editing the schema.",
    " */",
    "",
    ...interfaces
  ].join("\n");
}

function collectInterface(schemaNode, path, interfaces) {
  if (schemaNode.type !== "object" || !schemaNode.properties) {
    throw new Error(`Expected object schema at ${path || "<root>"}.`);
  }

  const typeName = getTypeName(path);
  const required = new Set(schemaNode.required ?? []);
  const lines = [`export interface ${typeName} {`];

  for (const [propertyName, propertySchema] of Object.entries(schemaNode.properties)) {
    const optional = required.has(propertyName) ? "" : "?";
    const propertyType = resolveType(propertySchema, joinSchemaPath(path, propertyName), interfaces);
    lines.push(`  ${propertyName}${optional}: ${propertyType};`);
  }

  lines.push("}", "");
  interfaces.push(...lines);
}

function resolveType(schemaNode, path, interfaces) {
  if (schemaNode.const !== undefined) {
    return literalType(schemaNode.const);
  }

  if (Array.isArray(schemaNode.enum)) {
    return schemaNode.enum.map(literalType).join(" | ");
  }

  if (schemaNode.type === "string") {
    return "string";
  }

  if (schemaNode.type === "integer" || schemaNode.type === "number") {
    return "number";
  }

  if (schemaNode.type === "boolean") {
    return "boolean";
  }

  if (schemaNode.type === "array") {
    return `${resolveArrayItemType(schemaNode.items ?? {}, `${path}[]`, interfaces)}[]`;
  }

  if (schemaNode.type === "object") {
    collectInterface(schemaNode, path, interfaces);
    return getTypeName(path);
  }

  throw new Error(`Unsupported schema node at ${path}.`);
}

function resolveArrayItemType(schemaNode, path, interfaces) {
  if (schemaNode.type === "object") {
    collectInterface(schemaNode, path, interfaces);
    return getTypeName(path);
  }

  return resolveType(schemaNode, path, interfaces);
}

function literalType(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  throw new Error("Only string, number, and boolean literal schema values are supported.");
}

function getTypeName(path) {
  const typeName = typeNames.get(path);
  if (!typeName) {
    throw new Error(`Missing TypeScript type name for schema path ${path}.`);
  }

  return typeName;
}

function joinSchemaPath(path, propertyName) {
  return path ? `${path}.${propertyName}` : propertyName;
}

function writeGeneratedTypes(source) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, source, "utf8");
  console.log("manifest TypeScript types generated");
}

function checkGeneratedTypes(source) {
  let currentSource = "";

  try {
    currentSource = readFileSync(outputPath, "utf8");
  } catch {
    throw new Error("Generated manifest TypeScript types are missing.");
  }

  if (normalizeNewlines(currentSource) !== normalizeNewlines(source)) {
    throw new Error(
      "Generated manifest TypeScript types are stale. Run `npm run generate:manifest-types`."
    );
  }

  console.log("manifest TypeScript types verified");
}

function normalizeNewlines(value) {
  return value.replaceAll("\r\n", "\n");
}

function parseOptions(args) {
  const options = {
    check: false,
    print: false
  };

  for (const arg of args) {
    if (arg === "--check") {
      options.check = true;
    } else if (arg === "--print") {
      options.print = true;
    } else {
      throw new Error(`Unsupported option: ${arg}`);
    }
  }

  if (options.check && options.print) {
    throw new Error("--check and --print cannot be combined.");
  }

  return options;
}
