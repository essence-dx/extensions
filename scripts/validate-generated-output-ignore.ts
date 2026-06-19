import { execFileSync } from "node:child_process";
import { normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface GeneratedOutputContract {
  ignoredPath: string;
  trackedPathspec: string;
}

export const generatedOutputContracts: GeneratedOutputContract[] = [
  {
    ignoredPath: "hosts/browser/dx-browser/dist/browser/chromium/manifest.json",
    trackedPathspec: ":(glob)hosts/browser/dx-browser/dist/**"
  },
  {
    ignoredPath: "hosts/browser/dx-browser/dist/browser/edge/manifest.json",
    trackedPathspec: ":(glob)hosts/browser/dx-browser/dist/**"
  },
  {
    ignoredPath: "hosts/browser/dx-browser/dist/browser/firefox/manifest.json",
    trackedPathspec: ":(glob)hosts/browser/dx-browser/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.browser.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.figma.command-center/loaded-host-preflight-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.visual-studio.command-center/host-discovery-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/progress-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/release-evidence-gaps-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/vscode/dx-vscode/dist/extension.js",
    trackedPathspec: ":(glob)hosts/vscode/dx-vscode/dist/**"
  },
  {
    ignoredPath: "hosts/vscode/dx-vscode/dx-vscode-0.1.0.vsix",
    trackedPathspec: ":(glob)hosts/vscode/dx-vscode/*.vsix"
  },
  {
    ignoredPath: "hosts/blender/dx-blender/dist/__init__.py",
    trackedPathspec: ":(glob)hosts/blender/dx-blender/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.blender.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/canva/dx-canva/app.js",
    trackedPathspec: "hosts/canva/dx-canva/app.js"
  },
  {
    ignoredPath: "hosts/canva/dx-canva/app.js.map",
    trackedPathspec: "hosts/canva/dx-canva/app.js.map"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.canva.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/obsidian/dx-command-center/main.js",
    trackedPathspec: "hosts/obsidian/dx-command-center/main.js"
  },
  {
    ignoredPath: "hosts/obsidian/dx-command-center/main.js.map",
    trackedPathspec: "hosts/obsidian/dx-command-center/main.js.map"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.obsidian.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/figma/dx-figma/main.js",
    trackedPathspec: "hosts/figma/dx-figma/main.js"
  },
  {
    ignoredPath: "hosts/figma/dx-figma/main.js.map",
    trackedPathspec: "hosts/figma/dx-figma/main.js.map"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.figma.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/sketch/dx-sketch/dx-sketch.sketchplugin/Contents/Sketch/index.js",
    trackedPathspec: ":(glob)hosts/sketch/dx-sketch/*.sketchplugin/**"
  },
  {
    ignoredPath: "hosts/sketch/dx-sketch/dx-sketch.sketchplugin/Contents/Sketch/index.js.map",
    trackedPathspec: ":(glob)hosts/sketch/dx-sketch/*.sketchplugin/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.sketch.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/adobe/dx-photoshop-uxp/dist/index.js",
    trackedPathspec: ":(glob)hosts/adobe/dx-photoshop-uxp/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.photoshop.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/adobe/dx-premiere-pro-uxp/dist/index.js",
    trackedPathspec: ":(glob)hosts/adobe/dx-premiere-pro-uxp/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.premiere-pro.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/adobe/dx-indesign-uxp/dist/index.js",
    trackedPathspec: ":(glob)hosts/adobe/dx-indesign-uxp/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.indesign.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.davinci-resolve.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/office/dx-excel/dist/taskpane.js",
    trackedPathspec: ":(glob)hosts/office/dx-excel/dist/**"
  },
  {
    ignoredPath: "hosts/office/dx-excel/dist/manifest.xml",
    trackedPathspec: ":(glob)hosts/office/dx-excel/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.excel.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/office/dx-powerpoint/dist/taskpane.js",
    trackedPathspec: ":(glob)hosts/office/dx-powerpoint/dist/**"
  },
  {
    ignoredPath: "hosts/office/dx-powerpoint/dist/manifest.xml",
    trackedPathspec: ":(glob)hosts/office/dx-powerpoint/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.powerpoint.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/office/dx-word/dist/taskpane.js",
    trackedPathspec: ":(glob)hosts/office/dx-word/dist/**"
  },
  {
    ignoredPath: "hosts/office/dx-word/dist/manifest.xml",
    trackedPathspec: ":(glob)hosts/office/dx-word/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.word.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/jetbrains/dx-intellij-platform/build/libs/dx-intellij-platform-command-center.jar",
    trackedPathspec: ":(glob)hosts/jetbrains/dx-intellij-platform/build/**"
  },
  {
    ignoredPath: "hosts/jetbrains/dx-intellij-platform/.gradle/configuration-cache",
    trackedPathspec: ":(glob)hosts/jetbrains/dx-intellij-platform/.gradle/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.intellij-platform.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/visual-studio/dx-visual-studio/bin/Debug/Dx.VisualStudio.CommandCenter.dll",
    trackedPathspec: ":(glob)hosts/visual-studio/dx-visual-studio/bin/**"
  },
  {
    ignoredPath: "hosts/visual-studio/dx-visual-studio/obj/project.assets.json",
    trackedPathspec: ":(glob)hosts/visual-studio/dx-visual-studio/obj/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.visual-studio.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/unity/dx-unity-editor/Library/ScriptAssemblies/DX.Unity.Editor.dll",
    trackedPathspec: ":(glob)hosts/unity/dx-unity-editor/Library/**"
  },
  {
    ignoredPath: "hosts/unity/dx-unity-editor/Temp/UnityTempFile",
    trackedPathspec: ":(glob)hosts/unity/dx-unity-editor/Temp/**"
  },
  {
    ignoredPath: "hosts/unity/dx-unity-editor/dist/dev.dx.unity-command-center-0.1.0.tgz",
    trackedPathspec: ":(glob)hosts/unity/dx-unity-editor/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.unity-editor.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/unreal/dx-unreal-engine/Binaries/Win64/UnrealEditor-DXUnrealCommandCenterEditor.dll",
    trackedPathspec: ":(glob)hosts/unreal/dx-unreal-engine/Binaries/**"
  },
  {
    ignoredPath: "hosts/unreal/dx-unreal-engine/Intermediate/Build/receipt.json",
    trackedPathspec: ":(glob)hosts/unreal/dx-unreal-engine/Intermediate/**"
  },
  {
    ignoredPath: "hosts/unreal/dx-unreal-engine/Saved/Packages/DXUnrealCommandCenter-0.1.0.zip",
    trackedPathspec: ":(glob)hosts/unreal/dx-unreal-engine/Saved/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.unreal-engine.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/google-workspace/dx-google-workspace-addon/.clasp.json",
    trackedPathspec: "hosts/google-workspace/dx-google-workspace-addon/.clasp.json"
  },
  {
    ignoredPath: "hosts/google-workspace/dx-google-workspace-addon/dist/Code.gs",
    trackedPathspec: ":(glob)hosts/google-workspace/dx-google-workspace-addon/dist/**"
  },
  {
    ignoredPath: "hosts/google-workspace/dx-google-workspace-addon/dist/appsscript.json",
    trackedPathspec: ":(glob)hosts/google-workspace/dx-google-workspace-addon/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.google-workspace.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/zed/dx-zed/extension.wasm",
    trackedPathspec: "hosts/zed/dx-zed/extension.wasm"
  },
  {
    ignoredPath: "hosts/zed/dx-zed/target/wasm32-unknown-unknown/debug/dx_command_center.wasm",
    trackedPathspec: ":(glob)hosts/zed/dx-zed/target/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.zed.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: "hosts/affinity/dx-affinity-content/dist/dx-icons.afassets",
    trackedPathspec: ":(glob)hosts/affinity/dx-affinity-content/dist/**"
  },
  {
    ignoredPath: "hosts/affinity/dx-affinity-content/dist/content-package/swatches/dx-core.ase",
    trackedPathspec: ":(glob)hosts/affinity/dx-affinity-content/dist/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.vscode.command-center/readiness-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  },
  {
    ignoredPath: ".dx/receipts/extensions/dx.vscode.command-center/package-output-latest.json",
    trackedPathspec: ":(glob).dx/receipts/**"
  }
];

export function validateGeneratedOutputIgnore(
  root = process.cwd(),
  contracts = generatedOutputContracts
): string[] {
  const failures: string[] = [];

  for (const contract of contracts) {
    if (!isIgnored(root, contract.ignoredPath)) {
      failures.push(`${contract.ignoredPath} must be ignored generated output`);
    }

    if (isTracked(root, contract.trackedPathspec)) {
      failures.push(`${contract.trackedPathspec} must not be tracked generated output`);
    }
  }

  return failures;
}

if (isDirectRun()) {
  const failures = validateGeneratedOutputIgnore();

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("generated output ignore policy verified");
}

function isIgnored(root: string, relativePath: string): boolean {
  const result = runGit(root, ["check-ignore", "--quiet", "--", relativePath]);
  return result.status === 0;
}

function isTracked(root: string, pathspec: string): boolean {
  const result = runGit(root, ["ls-files", "--", pathspec]);
  return result.status === 0 && result.stdout.trim().length > 0;
}

function runGit(root: string, args: string[]) {
  try {
    const stdout = execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    return {
      status: 0,
      stdout
    };
  } catch (error) {
    return {
      status: typeof error.status === "number" ? error.status : 1,
      stdout: error.stdout?.toString() ?? ""
    };
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
