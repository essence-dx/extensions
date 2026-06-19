import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const requiredFiles = {
  command: "crates/dx-browser-native-host/src/command.rs",
  protocol: "crates/dx-browser-native-host/src/protocol.rs",
  host: "crates/dx-browser-native-host/src/host.rs",
  commandPlans: "hosts/browser/dx-browser/src/runtime/commandPlans.ts",
  browserProtocol: "hosts/browser/dx-browser/src/runtime/protocol.ts"
};

const expectedCommands = [
  {
    id: "status",
    operation: "dx.status",
    rustArgs: 'vec!["status".to_string()]',
    typeScriptArgs: 'args: ["status"]',
    message: "status command plan must map to dx status"
  },
  {
    id: "doctor",
    operation: "dx.doctor",
    rustArgs: 'vec!["doctor".to_string()]',
    typeScriptArgs: 'args: ["doctor"]',
    message: "doctor command plan must map to dx doctor"
  },
  {
    id: "forgePackages",
    operation: "dx.forge.packages.list",
    rustArgs:
      'vec!["forge".to_string(), "packages".to_string(), "--json".to_string()]',
    typeScriptArgs: 'args: ["forge", "packages", "--json"]',
    message: "forgePackages command plan must map to dx forge packages --json"
  },
  {
    id: "showBuildGraph",
    operation: "dx.graph.read",
    rustArgs: 'vec!["graph".to_string(), "--json".to_string()]',
    typeScriptArgs: 'args: ["graph", "--json"]',
    message: "showBuildGraph command plan must map to dx graph --json"
  }
];

export function validateNativeHostCommandBoundary(root) {
  const failures = [];
  const sources = {};

  for (const [key, relativePath] of Object.entries(requiredFiles)) {
    const absolutePath = join(root, ...relativePath.split("/"));
    if (!existsSync(absolutePath)) {
      failures.push(`missing native-host command boundary file: ${relativePath}`);
      continue;
    }

    sources[key] = readFileSync(absolutePath, "utf8");
  }

  if (Object.keys(sources).length !== Object.keys(requiredFiles).length) {
    return failures;
  }

  validateRustProtocol(sources.protocol, failures);
  validateRustHost(sources.host, failures);
  validateRustCommandRunner(sources.command, failures);
  validateBrowserCommandPlans(sources.commandPlans, failures);
  validateBrowserProtocol(sources.browserProtocol, failures);

  return failures;
}

function validateRustProtocol(source, failures) {
  requireSourceText(
    source,
    "pub command: DxCliCommand",
    "native host request must carry a typed DX CLI command",
    failures
  );
  requireSourceText(
    source,
    "pub struct DxCliCommand",
    "native host protocol must define DxCliCommand",
    failures
  );
  requireSourceText(
    source,
    "pub executable: String",
    "native host command must carry executable",
    failures
  );
  requireSourceText(
    source,
    "pub args: Vec<String>",
    "native host command must carry argv",
    failures
  );
}

function validateRustHost(source, failures) {
  requireSourceText(
    source,
    "validate_dx_cli_command",
    "native host must validate the DX CLI command plan",
    failures
  );
  requireSourceText(
    source,
    "validate_dx_cli_command",
    "native host must validate the DX CLI command plan",
    failures
  );

  for (const expectedCommand of expectedCommands) {
    requireRustCommandText(
      source,
      `DxCliCommand::new("dx", ${expectedCommand.rustArgs})`,
      `native host ${expectedCommand.message}`,
      failures
    );
  }
}

function validateRustCommandRunner(source, failures) {
  requireSourceText(
    source,
    "Command::new(&self.binary_path)",
    "native host command runner must execute the configured dx.exe directly",
    failures
  );
  requireSourceText(
    source,
    ".args(&command.args)",
    "native host command runner must pass argv separately",
    failures
  );
  requireSourceText(
    source,
    ".stdin(Stdio::null())",
    "native host command runner must discard stdin",
    failures
  );
  requireSourceText(
    source,
    ".stdout(Stdio::null())",
    "native host command runner must discard stdout",
    failures
  );
  requireSourceText(
    source,
    ".stderr(Stdio::null())",
    "native host command runner must discard stderr",
    failures
  );
  requireSourceText(
    source,
    "child.kill()",
    "native host command runner must kill timed-out commands",
    failures
  );
  requireSourceText(
    source,
    "child.wait()",
    "native host command runner must reap timed-out commands",
    failures
  );
  requireSourceText(
    source,
    'Some("dx.exe")',
    "native host command runner must require dx.exe",
    failures
  );
  requireSourceText(
    source,
    "is_allowlisted_command",
    "native host command runner must keep its own command allowlist",
    failures
  );
  rejectSourcePattern(
    source,
    /\b(Command::new|\.arg)\s*\(\s*"(?:(?:powershell)|(?:pwsh)|(?:cmd)|(?:sh)|(?:cargo)|(?:npm)|(?:turbo))"/i,
    "native host command runner must not invoke shell, build, or package executables",
    failures
  );
  rejectSourcePattern(
    source,
    /\b(?:ComSpec|powershell|pwsh|cmd\.exe|cmd|dx\.ps1|dx\.cmd)\b/i,
    "native host command runner must reject wrapper and shell references",
    failures
  );
}

function validateBrowserCommandPlans(source, failures) {
  for (const expectedCommand of expectedCommands) {
    const planSource = extractCommandPlan(source, expectedCommand.id);
    if (!planSource) {
      failures.push(`browser ${expectedCommand.id} command plan is missing`);
      continue;
    }

    requireSourceText(
      planSource,
      'executable: "dx"',
      `browser ${expectedCommand.message}`,
      failures
    );
    requireSourceText(
      planSource,
      expectedCommand.typeScriptArgs,
      `browser ${expectedCommand.message}`,
      failures
    );
  }
}

function validateBrowserProtocol(source, failures) {
  requireSourceText(
    source,
    "command: copyNativeCommand(input.plan.nativeCommand)",
    "browser protocol must copy the typed native command into requests",
    failures
  );
  requireSourceText(
    source,
    "Native-host command args must not contain shell control characters.",
    "browser protocol must reject shell control characters in command args",
    failures
  );
}

function extractCommandPlan(source, id) {
  const idIndex = source.indexOf(`id: "${id}"`);
  if (idIndex === -1) {
    return undefined;
  }

  const planOrder = [...expectedCommands.map((command) => command.id), "openReceipts"];
  const currentIndex = planOrder.indexOf(id);
  const nextPlanIndex = planOrder
    .slice(currentIndex + 1)
    .map((nextId) => source.indexOf(`\n  ${nextId}:`, idIndex))
    .filter((index) => index !== -1)
    .sort((left, right) => left - right)[0];

  return source.slice(idIndex, nextPlanIndex === -1 ? undefined : nextPlanIndex);
}

function requireSourceText(source, text, message, failures) {
  const hasText =
    normalizeSourceText(source).includes(normalizeSourceText(text)) ||
    compactSourceText(source).includes(compactSourceText(text));

  if (!hasText) {
    failures.push(message);
  }
}

function requireRustCommandText(source, text, message, failures) {
  const sourceText = compactSourceText(source);
  const acceptedTexts = [
    text,
    text.replace(/\]\)$/, "],)"),
    text.replace(/\]\)$/, ",])"),
    text.replace(/\]\)$/, ",],)")
  ].map(compactSourceText);

  if (!acceptedTexts.some((expectedText) => sourceText.includes(expectedText))) {
    failures.push(message);
  }
}

function rejectSourcePattern(source, pattern, message, failures) {
  if (pattern.test(source)) {
    failures.push(message);
  }
}

function normalizeSourceText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function compactSourceText(value) {
  return value.replace(/\s+/g, "");
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  const failures = validateNativeHostCommandBoundary(process.cwd());

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("native-host command boundary verified");
}
