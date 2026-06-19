import { join } from "node:path";

import type {
  PlatformHostDiscoveryTarget,
  PlatformHostToolRequirement
} from "./platform-host-discovery-model.ts";

export const defaultPlatformHostDiscoveryTargets: PlatformHostDiscoveryTarget[] = [
  {
    adapterId: "dx.vscode.command-center",
    discoveryMode: "local-tooling",
    host: "vscode",
    unavailableReason: "vscode_cli_unavailable",
    tools: [
      {
        id: "vscode-cli",
        label: "VS Code CLI",
        required: true,
        executableNames: ["code.cmd", "code-insiders.cmd", "code.exe", "code"],
        candidatePaths: [
          localAppDataPath("Programs", "Microsoft VS Code", "bin", "code.cmd"),
          localAppDataPath("Programs", "Microsoft VS Code Insiders", "bin", "code-insiders.cmd"),
          localAppDataPath("Programs", "Microsoft VS Code", "Code.exe"),
          localAppDataPath("Programs", "Microsoft VS Code Insiders", "Code - Insiders.exe"),
          programFilesPath("Microsoft VS Code", "bin", "code.cmd"),
          programFilesPath("Microsoft VS Code Insiders", "bin", "code-insiders.cmd"),
          programFilesPath("Microsoft VS Code", "Code.exe"),
          programFilesPath("Microsoft VS Code Insiders", "Code - Insiders.exe"),
          programFilesX86Path("Microsoft VS Code", "bin", "code.cmd")
        ]
      }
    ]
  },
  {
    adapterId: "dx.browser.command-center",
    discoveryMode: "local-tooling",
    host: "browser",
    unavailableReason: "required_browsers_unavailable",
    tools: [
      {
        id: "chrome",
        label: "Google Chrome executable",
        required: true,
        executableNames: ["chrome.exe"],
        candidatePaths: [
          programFilesPath("Google", "Chrome", "Application", "chrome.exe"),
          programFilesX86Path("Google", "Chrome", "Application", "chrome.exe"),
          localAppDataPath("Google", "Chrome", "Application", "chrome.exe")
        ]
      },
      {
        id: "edge",
        label: "Microsoft Edge executable",
        required: true,
        executableNames: ["msedge.exe"],
        candidatePaths: [
          programFilesPath("Microsoft", "Edge", "Application", "msedge.exe"),
          programFilesX86Path("Microsoft", "Edge", "Application", "msedge.exe"),
          localAppDataPath("Microsoft", "Edge", "Application", "msedge.exe")
        ]
      },
      {
        id: "firefox",
        label: "Mozilla Firefox executable",
        required: true,
        executableNames: ["firefox.exe"],
        candidatePaths: [
          programFilesPath("Mozilla Firefox", "firefox.exe"),
          programFilesX86Path("Mozilla Firefox", "firefox.exe"),
          localAppDataPath("Mozilla Firefox", "firefox.exe")
        ]
      }
    ]
  },
  {
    adapterId: "dx.blender.command-center",
    discoveryMode: "local-tooling",
    host: "blender",
    unavailableReason: "blender_unavailable",
    tools: [
      {
        id: "blender",
        label: "Blender executable",
        required: true,
        executableNames: ["blender.exe"],
        candidatePaths: versionedProgramFilesPaths("Blender Foundation", "Blender", "blender.exe")
      }
    ]
  },
  {
    adapterId: "dx.obsidian.command-center",
    discoveryMode: "local-tooling",
    host: "obsidian",
    unavailableReason: "obsidian_unavailable",
    tools: [
      {
        id: "obsidian",
        label: "Obsidian executable",
        required: true,
        executableNames: ["Obsidian.exe", "obsidian.exe"],
        candidatePaths: [
          localAppDataPath("Obsidian", "Obsidian.exe"),
          localAppDataPath("Programs", "Obsidian", "Obsidian.exe"),
          programFilesPath("Obsidian", "Obsidian.exe"),
          programFilesX86Path("Obsidian", "Obsidian.exe")
        ]
      }
    ]
  },
  {
    adapterId: "dx.figma.command-center",
    discoveryMode: "local-tooling",
    host: "figma",
    unavailableReason: "figma_desktop_unavailable",
    tools: [
      {
        id: "figma",
        label: "Figma desktop executable",
        required: true,
        executableNames: ["Figma.exe"],
        candidatePaths: [localAppDataPath("Figma", "Figma.exe")]
      }
    ]
  },
  {
    adapterId: "dx.canva.command-center",
    discoveryMode: "cloud-service",
    host: "canva",
    readyReason: "canva_developer_app_requires_authenticated_cloud_workspace",
    unavailableReason: "canva_developer_app_not_configured",
    notes: ["Canva Apps SDK proof is cloud/developer-console based; no local host executable is launched."],
    tools: []
  },
  {
    adapterId: "dx.sketch.command-center",
    discoveryMode: "local-tooling",
    host: "sketch",
    unavailableReason: "sketch_or_sketchtool_unavailable",
    notes: ["Sketch is macOS-only; Windows discovery is expected to be missing unless a compatible tool is supplied."],
    tools: [
      {
        id: "sketchtool",
        label: "Sketch command-line tool",
        required: true,
        executableNames: ["sketchtool"],
        candidatePaths: ["/Applications/Sketch.app/Contents/Resources/sketchtool/bin/sketchtool"]
      }
    ]
  },
  {
    adapterId: "dx.excel.command-center",
    discoveryMode: "local-tooling",
    host: "excel",
    unavailableReason: "excel_unavailable",
    tools: [officeExecutable("excel", "Excel executable", "EXCEL.EXE")]
  },
  {
    adapterId: "dx.powerpoint.command-center",
    discoveryMode: "local-tooling",
    host: "powerpoint",
    unavailableReason: "powerpoint_unavailable",
    tools: [officeExecutable("powerpoint", "PowerPoint executable", "POWERPNT.EXE")]
  },
  {
    adapterId: "dx.word.command-center",
    discoveryMode: "local-tooling",
    host: "word",
    unavailableReason: "word_unavailable",
    tools: [officeExecutable("word", "Word executable", "WINWORD.EXE")]
  },
  {
    adapterId: "dx.zed.command-center",
    discoveryMode: "local-tooling",
    host: "zed",
    unavailableReason: "zed_unavailable",
    tools: [
      {
        id: "zed",
        label: "Zed executable",
        required: true,
        executableNames: ["zed.exe", "zed.cmd", "Zed.exe"],
        candidatePaths: [
          localAppDataPath("Programs", "Zed", "Zed.exe"),
          localAppDataPath("Zed", "Zed.exe"),
          programFilesPath("Zed", "Zed.exe")
        ]
      }
    ]
  },
  adobeUxpTarget("dx.photoshop.command-center", "photoshop", "Photoshop executable", "Photoshop.exe", [
    "Adobe Photoshop 2026",
    "Adobe Photoshop 2025",
    "Adobe Photoshop 2024"
  ]),
  adobeUxpTarget(
    "dx.premiere-pro.command-center",
    "premiere-pro",
    "Premiere Pro executable",
    "Adobe Premiere Pro.exe",
    ["Adobe Premiere Pro 2026", "Adobe Premiere Pro 2025", "Adobe Premiere Pro 2024"]
  ),
  adobeUxpTarget("dx.indesign.command-center", "indesign", "InDesign executable", "InDesign.exe", [
    "Adobe InDesign 2026",
    "Adobe InDesign 2025",
    "Adobe InDesign 2024"
  ]),
  {
    adapterId: "dx.davinci-resolve.command-center",
    discoveryMode: "local-tooling",
    host: "davinci-resolve",
    unavailableReason: "davinci_resolve_unavailable",
    tools: [
      {
        id: "resolve",
        label: "DaVinci Resolve executable",
        required: true,
        executableNames: ["Resolve.exe", "DaVinci Resolve.exe"],
        candidatePaths: [
          programFilesPath("Blackmagic Design", "DaVinci Resolve", "Resolve.exe"),
          programFilesPath("Blackmagic Design", "DaVinci Resolve", "DaVinci Resolve.exe")
        ]
      }
    ]
  },
  {
    adapterId: "dx.intellij-platform.command-center",
    discoveryMode: "local-tooling",
    host: "intellij-platform",
    unavailableReason: "intellij_or_gradle_unavailable",
    tools: [
      {
        id: "idea",
        label: "IntelliJ IDEA executable",
        required: true,
        executableNames: ["idea64.exe", "idea.exe"],
        candidatePaths: [
          programFilesPath("JetBrains", "IntelliJ IDEA 2026.1", "bin", "idea64.exe"),
          programFilesPath("JetBrains", "IntelliJ IDEA 2025.3", "bin", "idea64.exe"),
          programFilesPath("JetBrains", "IntelliJ IDEA 2025.2", "bin", "idea64.exe")
        ]
      },
      {
        id: "gradle",
        label: "Gradle executable",
        required: true,
        executableNames: ["gradle.bat", "gradle.exe"]
      }
    ]
  },
  {
    adapterId: "dx.visual-studio.command-center",
    discoveryMode: "local-tooling",
    host: "visual-studio",
    unavailableReason: "visual_studio_sdk_unavailable",
    tools: [
      {
        id: "devenv",
        label: "Visual Studio IDE",
        required: true,
        executableNames: ["devenv.exe"],
        candidatePaths: ["F:\\Visual-Studio\\PROGRAM\\Common7\\IDE\\devenv.exe"]
      },
      {
        id: "msbuild",
        label: "MSBuild executable",
        required: true,
        executableNames: ["MSBuild.exe"],
        candidatePaths: [
          "F:\\Visual-Studio\\PROGRAM\\MSBuild\\Current\\Bin\\MSBuild.exe",
          "F:\\Visual-Studio\\PROGRAM\\MSBuild\\Current\\Bin\\amd64\\MSBuild.exe"
        ]
      },
      {
        id: "dotnet",
        label: ".NET SDK executable",
        required: true,
        executableNames: ["dotnet.exe"],
        candidatePaths: ["C:\\Program Files\\dotnet\\dotnet.exe"]
      },
      {
        id: "vssdk-targets",
        label: "Visual Studio SDK targets",
        required: true,
        candidatePaths: [
          "F:\\Visual-Studio\\PROGRAM\\MSBuild\\Microsoft\\VisualStudio\\v17.0\\VSSDK\\Microsoft.VsSDK.targets",
          "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Microsoft\\VisualStudio\\v17.0\\VSSDK\\Microsoft.VsSDK.targets",
          "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\MSBuild\\Microsoft\\VisualStudio\\v17.0\\VSSDK\\Microsoft.VsSDK.targets",
          "C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\MSBuild\\Microsoft\\VisualStudio\\v17.0\\VSSDK\\Microsoft.VsSDK.targets"
        ]
      }
    ]
  },
  {
    adapterId: "dx.unity-editor.command-center",
    discoveryMode: "local-tooling",
    host: "unity-editor",
    unavailableReason: "unity_editor_unavailable",
    tools: [
      {
        id: "unity-editor",
        label: "Unity Editor executable",
        required: true,
        executableNames: ["Unity.exe"],
        candidatePaths: [
          programFilesPath("Unity", "Hub", "Editor", "6000.0.0f1", "Editor", "Unity.exe"),
          programFilesPath("Unity", "Hub", "Editor", "2023.3.0f1", "Editor", "Unity.exe"),
          programFilesPath("Unity", "Editor", "Unity.exe")
        ]
      }
    ]
  },
  {
    adapterId: "dx.unreal-engine.command-center",
    discoveryMode: "local-tooling",
    host: "unreal-engine",
    unavailableReason: "unreal_editor_unavailable",
    tools: [
      {
        id: "unreal-editor",
        label: "Unreal Editor executable",
        required: true,
        executableNames: ["UnrealEditor.exe", "UnrealEditor-Cmd.exe"],
        candidatePaths: [
          programFilesPath("Epic Games", "UE_5.6", "Engine", "Binaries", "Win64", "UnrealEditor.exe"),
          programFilesPath("Epic Games", "UE_5.5", "Engine", "Binaries", "Win64", "UnrealEditor.exe"),
          programFilesPath("Epic Games", "UE_5.4", "Engine", "Binaries", "Win64", "UnrealEditor.exe")
        ]
      }
    ]
  },
  {
    adapterId: "dx.google-workspace.command-center",
    discoveryMode: "cloud-service",
    host: "google-workspace",
    readyReason: "apps_script_deployment_requires_authenticated_cloud_workspace",
    unavailableReason: "google_workspace_deployment_not_configured",
    notes: ["Google Workspace proof is Apps Script/OAuth/cloud-service based; no local host executable is launched."],
    tools: [
      {
        id: "clasp",
        label: "Google Apps Script clasp CLI",
        required: false,
        executableNames: ["clasp.cmd", "clasp"]
      },
      {
        id: "gcloud",
        label: "Google Cloud CLI",
        required: false,
        executableNames: ["gcloud.cmd", "gcloud"]
      }
    ]
  },
  {
    adapterId: "dx.affinity-content.bridge",
    discoveryMode: "manual-only",
    host: "affinity",
    readyReason: "manual_affinity_import_required",
    unavailableReason: "affinity_app_unavailable",
    notes: ["Affinity content bridge proof requires a real importable content package and manual import receipt."],
    tools: [
      {
        id: "affinity-designer",
        label: "Affinity Designer executable",
        required: false,
        executableNames: ["Designer.exe"],
        candidatePaths: [
          programFilesPath("Affinity", "Designer 2", "Designer.exe"),
          programFilesPath("Affinity", "Designer", "Designer.exe")
        ]
      },
      {
        id: "affinity-photo",
        label: "Affinity Photo executable",
        required: false,
        executableNames: ["Photo.exe"],
        candidatePaths: [
          programFilesPath("Affinity", "Photo 2", "Photo.exe"),
          programFilesPath("Affinity", "Photo", "Photo.exe")
        ]
      },
      {
        id: "affinity-publisher",
        label: "Affinity Publisher executable",
        required: false,
        executableNames: ["Publisher.exe"],
        candidatePaths: [
          programFilesPath("Affinity", "Publisher 2", "Publisher.exe"),
          programFilesPath("Affinity", "Publisher", "Publisher.exe")
        ]
      }
    ]
  }
];

function adobeUxpTarget(
  adapterId: string,
  host: string,
  hostLabel: string,
  hostExecutableName: string,
  hostDirectories: string[]
): PlatformHostDiscoveryTarget {
  return {
    adapterId,
    discoveryMode: "local-tooling",
    host,
    unavailableReason: `${host.replaceAll("-", "_")}_or_uxp_developer_tool_unavailable`,
    tools: [
      {
        id: host,
        label: hostLabel,
        required: true,
        executableNames: [hostExecutableName],
        candidatePaths: hostDirectories.map((directory) => programFilesPath("Adobe", directory, hostExecutableName))
      },
      {
        id: "uxp-developer-tool",
        label: "Adobe UXP Developer Tool executable",
        required: true,
        executableNames: ["UXP Developer Tool.exe"],
        candidatePaths: [
          programFilesPath("Adobe", "Adobe UXP Developer Tool", "UXP Developer Tool.exe"),
          localAppDataPath("Programs", "Adobe UXP Developer Tool", "UXP Developer Tool.exe")
        ]
      }
    ]
  };
}

function officeExecutable(id: string, label: string, executableName: string): PlatformHostToolRequirement {
  return {
    id,
    label,
    required: true,
    executableNames: [executableName],
    candidatePaths: [
      programFilesPath("Microsoft Office", "root", "Office16", executableName),
      programFilesX86Path("Microsoft Office", "root", "Office16", executableName)
    ]
  };
}

function versionedProgramFilesPaths(vendor: string, productPrefix: string, executableName: string): string[] {
  return ["4.4", "4.3", "4.2", "4.1", "4.0", "3.6", "3.5"].map((version) =>
    programFilesPath(vendor, `${productPrefix} ${version}`, executableName)
  );
}

function localAppDataPath(...segments: string[]): string {
  return join(process.env.LOCALAPPDATA ?? join(userProfilePath(), "AppData", "Local"), ...segments);
}

function programFilesPath(...segments: string[]): string {
  return join(process.env.ProgramFiles ?? "C:\\Program Files", ...segments);
}

function programFilesX86Path(...segments: string[]): string {
  return join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", ...segments);
}

function userProfilePath(): string {
  return process.env.USERPROFILE ?? "C:\\Users\\Computer";
}
