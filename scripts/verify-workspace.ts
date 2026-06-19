import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { validateExtensionReadiness } from "./validate-extension-readiness.ts";
import { validateOfficialExtensionRegistry } from "./validate-official-registry.ts";
import { validateOfficialExtensionStarterPolicy } from "./validate-extension-starter-policy.ts";
import { validateGeneratedOutputIgnore } from "./validate-generated-output-ignore.ts";
import { validateProfessionalHostTargetCatalog } from "./validate-host-target-catalog.ts";
import { validateNativeHostCommandBoundary } from "./validate-native-host-command-boundary.ts";
import { validateOfficeLocalServiceBoundary } from "./validate-office-local-service-boundary.ts";
import { validateTypescriptSourceExtensions } from "./validate-typescript-source-extensions.ts";

const root = process.cwd();
const browserPermissionCapabilities = {
  activeTab: "browser.activeTab",
  nativeMessaging: "nativeMessaging.dx",
  sidePanel: "browser.sidePanel"
};
const requiredNodeEngine = ">=22.18.0";
const requiredPaths = [
  "Cargo.toml",
  "package.json",
  "registry/official-extensions.toml",
  "registry/extension-readiness.toml",
  "registry/release-evidence-gates.toml",
  "registry/professional-host-targets.toml",
  "schemas/dx.extension.manifest.schema.json",
  "schemas/types/dx-extension-manifest.d.ts",
  "crates/dx-browser-native-host/Cargo.toml",
  "crates/dx-browser-native-host/src/command.rs",
  "crates/dx-browser-native-host/src/framing.rs",
  "crates/dx-browser-native-host/src/host.rs",
  "crates/dx-browser-native-host/src/lib.rs",
  "crates/dx-browser-native-host/src/main.rs",
  "crates/dx-browser-native-host/src/protocol.rs",
  "crates/dx-browser-native-host/tests/native_host_protocol.rs",
  "crates/dx-extension-manifest/Cargo.toml",
  "hosts/browser/dx-browser/package.json",
  "hosts/browser/dx-browser/dx.extension.toml",
  "hosts/browser/dx-browser/manifests/manifest.chromium.json",
  "hosts/browser/dx-browser/manifests/manifest.edge.json",
  "hosts/browser/dx-browser/manifests/manifest.firefox.json",
  "hosts/browser/dx-browser/src/background/common.ts",
  "hosts/browser/dx-browser/src/background/platform.ts",
  "hosts/browser/dx-browser/src/runtime/commandPlans.ts",
  "hosts/browser/dx-browser/src/runtime/messages.ts",
  "hosts/browser/dx-browser/src/runtime/protocol.ts",
  "hosts/browser/dx-browser/src/runtime/nativeHostTransport.ts",
  "hosts/browser/dx-browser/src/ui/bootstrapCommandCenter.ts",
  "hosts/browser/dx-browser/src/ui/commandDispatch.ts",
  "hosts/browser/dx-browser/native-host/chromium/dev.dx.browser.template.json",
  "hosts/browser/dx-browser/native-host/firefox/dev.dx.browser.template.json",
  "hosts/browser/dx-browser/scripts/install-native-host.ps1",
  "hosts/browser/dx-browser/scripts/uninstall-native-host.ps1",
  "hosts/browser/dx-browser/scripts/install-native-host.sh",
  "hosts/browser/dx-browser/scripts/uninstall-native-host.sh",
  "hosts/browser/dx-browser/static/popup.html",
  "hosts/browser/dx-browser/static/sidepanel.html",
  "hosts/browser/dx-browser/static/sidebar.html",
  "hosts/browser/dx-browser/static/options.html",
  "hosts/browser/dx-browser/scripts/build.ts",
  "hosts/vscode/dx-vscode/src/commands/runHostUiCommand.ts",
  "hosts/browser/dx-browser/tests/commandPlans.test.ts",
  "hosts/browser/dx-browser/tests/protocol.test.ts",
  "hosts/browser/dx-browser/tests/manifestPolicy.test.ts",
  "hosts/browser/dx-browser/tests/manifestProtocol.test.ts",
  "hosts/browser/dx-browser/tests/nativeSurface.test.ts",
  "hosts/browser/dx-browser/tests/nativeHostManifest.test.ts",
  "hosts/browser/dx-browser/tests/nativeHostInstallProof.test.ts",
  "hosts/browser/dx-browser/tests/nativeHostShellInstallProof.test.ts",
  "hosts/browser/dx-browser/tests/nativeHostShellUninstallProof.test.ts",
  "hosts/browser/dx-browser/tests/nativeHostTransport.test.ts",
  "hosts/browser/dx-browser/tests/nativeHostBinarySmoke.test.ts",
  "hosts/browser/dx-browser/tests/nativeHostProcessRuntime.ts",
  "hosts/browser/dx-browser/tests/loadedBrowserCommandSmoke.test.ts",
  "hosts/browser/dx-browser/tests/loadedBrowserDispatchSmoke.test.ts",
  "hosts/browser/dx-browser/tests/backgroundDispatch.test.ts",
  "hosts/browser/dx-browser/tests/backgroundEntrypoints.test.ts",
  "hosts/browser/dx-browser/tests/uiDispatch.test.ts",
  "hosts/browser/dx-browser/tests/buildOutput.test.ts",
  "scripts/write-browser-loaded-profile-receipt.ts",
  "scripts/capture-browser-extension-ids.ts",
  "scripts/capture-browser-extension-ids-j1.ps1",
  "scripts/lib/browser-loaded-profile-devtools.ts",
  "scripts/lib/browser-loaded-profile-proof.ts",
  "scripts/run-browser-loaded-profile-smoke.ts",
  "scripts/tests/browserLoadedProfileReceipt.test.ts",
  "scripts/tests/browserExtensionIdCapture.test.ts",
  "scripts/tests/browserLoadedProfileSmokeRunner.test.ts",
  "scripts/tests/releaseEvidenceGapReportIdeGameEngineLoadedHost.test.ts",
  "scripts/tests/officeSideloadedHostReceipt.test.ts",
  "scripts/tests/j1WrapperProcessGuard.test.ts",
  "scripts/build-affinity-content-package.ts",
  "scripts/tests/affinityContentPackageOutput.test.ts",
  "scripts/write-affinity-content-package-receipt.ts",
  "scripts/tests/affinityContentPackageReceipt.test.ts",
  "scripts/package-affinity-content-j1.ps1",
  "scripts/write-affinity-manual-import-receipt.ts",
  "scripts/tests/affinityManualImportReceipt.test.ts",
  "scripts/smoke-affinity-manual-import-j1.ps1",
  "scripts/write-affinity-loaded-app-receipt.ts",
  "scripts/tests/affinityLoadedAppReceipt.test.ts",
  "scripts/smoke-affinity-loaded-app-j1.ps1",
  "scripts/write-affinity-photoshop-filter-plugin-receipt.ts",
  "scripts/tests/affinityPhotoshopFilterPluginReceipt.test.ts",
  "scripts/smoke-affinity-photoshop-filter-plugin-j1.ps1",
  "hosts/blender/dx-blender/dx.extension.toml",
  "hosts/blender/dx-blender/blender_manifest.toml",
  "hosts/blender/dx-blender/__init__.py",
  "hosts/blender/dx-blender/README.md",
  "hosts/obsidian/dx-command-center/dx.extension.toml",
  "hosts/obsidian/dx-command-center/manifest.json",
  "hosts/obsidian/dx-command-center/src/dxCommandRunner.ts",
  "hosts/obsidian/dx-command-center/src/main.ts",
  "hosts/obsidian/dx-command-center/.gitignore",
  "hosts/obsidian/dx-command-center/README.md",
  "hosts/figma/dx-figma/dx.extension.toml",
  "hosts/figma/dx-figma/manifest.json",
  "hosts/figma/dx-figma/src/messages.ts",
  "hosts/figma/dx-figma/src/commandPlans.ts",
  "hosts/figma/dx-figma/src/main.ts",
  "hosts/figma/dx-figma/ui.html",
  "hosts/figma/dx-figma/.gitignore",
  "hosts/figma/dx-figma/README.md",
  "hosts/canva/README.md",
  "hosts/canva/dx-canva/dx.extension.toml",
  "hosts/canva/dx-canva/canva-app.json",
  "hosts/canva/dx-canva/.gitignore",
  "hosts/canva/dx-canva/src/messages.ts",
  "hosts/canva/dx-canva/src/commandPlans.ts",
  "hosts/canva/dx-canva/src/app.tsx",
  "hosts/canva/dx-canva/README.md",
  "hosts/sketch/README.md",
  "hosts/sketch/dx-sketch/dx.extension.toml",
  "hosts/sketch/dx-sketch/manifest.json",
  "hosts/sketch/dx-sketch/.gitignore",
  "hosts/sketch/dx-sketch/src/messages.ts",
  "hosts/sketch/dx-sketch/src/commandPlans.ts",
  "hosts/sketch/dx-sketch/src/index.ts",
  "hosts/sketch/dx-sketch/README.md",
  "hosts/office/README.md",
  "hosts/office/shared/localServiceBoundary.ts",
  "hosts/office/dx-excel/dx.extension.toml",
  "hosts/office/dx-excel/manifest.xml",
  "hosts/office/dx-excel/.gitignore",
  "hosts/office/dx-excel/src/messages.ts",
  "hosts/office/dx-excel/src/commandPlans.ts",
  "hosts/office/dx-excel/src/taskpane.ts",
  "hosts/office/dx-excel/static/taskpane.html",
  "hosts/office/dx-excel/README.md",
  "hosts/office/dx-powerpoint/dx.extension.toml",
  "hosts/office/dx-powerpoint/manifest.xml",
  "hosts/office/dx-powerpoint/.gitignore",
  "hosts/office/dx-powerpoint/src/messages.ts",
  "hosts/office/dx-powerpoint/src/commandPlans.ts",
  "hosts/office/dx-powerpoint/src/taskpane.ts",
  "hosts/office/dx-powerpoint/static/taskpane.html",
  "hosts/office/dx-powerpoint/README.md",
  "hosts/office/dx-word/dx.extension.toml",
  "hosts/office/dx-word/manifest.xml",
  "hosts/office/dx-word/.gitignore",
  "hosts/office/dx-word/src/messages.ts",
  "hosts/office/dx-word/src/commandPlans.ts",
  "hosts/office/dx-word/src/taskpane.ts",
  "hosts/office/dx-word/static/taskpane.html",
  "hosts/office/dx-word/README.md",
  "hosts/zed/dx-zed/dx.extension.toml",
  "hosts/zed/dx-zed/extension.toml",
  "hosts/zed/dx-zed/Cargo.toml",
  "hosts/zed/dx-zed/Cargo.lock",
  "hosts/zed/dx-zed/.gitignore",
  "hosts/zed/dx-zed/src/command_plans.rs",
  "hosts/zed/dx-zed/src/lib.rs",
  "hosts/zed/dx-zed/README.md",
  "hosts/adobe/README.md",
  "hosts/adobe/dx-photoshop-uxp/dx.extension.toml",
  "hosts/adobe/dx-photoshop-uxp/manifest.json",
  "hosts/adobe/dx-photoshop-uxp/index.html",
  "hosts/adobe/dx-photoshop-uxp/.gitignore",
  "hosts/adobe/dx-photoshop-uxp/src/messages.ts",
  "hosts/adobe/dx-photoshop-uxp/src/commandPlans.ts",
  "hosts/adobe/dx-photoshop-uxp/src/index.ts",
  "hosts/adobe/dx-photoshop-uxp/README.md",
  "hosts/adobe/dx-premiere-pro-uxp/dx.extension.toml",
  "hosts/adobe/dx-premiere-pro-uxp/manifest.json",
  "hosts/adobe/dx-premiere-pro-uxp/index.html",
  "hosts/adobe/dx-premiere-pro-uxp/.gitignore",
  "hosts/adobe/dx-premiere-pro-uxp/src/messages.ts",
  "hosts/adobe/dx-premiere-pro-uxp/src/commandPlans.ts",
  "hosts/adobe/dx-premiere-pro-uxp/src/index.ts",
  "hosts/adobe/dx-premiere-pro-uxp/README.md",
  "hosts/adobe/dx-indesign-uxp/dx.extension.toml",
  "hosts/adobe/dx-indesign-uxp/manifest.json",
  "hosts/adobe/dx-indesign-uxp/index.html",
  "hosts/adobe/dx-indesign-uxp/.gitignore",
  "hosts/adobe/dx-indesign-uxp/src/messages.ts",
  "hosts/adobe/dx-indesign-uxp/src/commandPlans.ts",
  "hosts/adobe/dx-indesign-uxp/src/index.ts",
  "hosts/adobe/dx-indesign-uxp/README.md",
  "hosts/blackmagic/README.md",
  "hosts/blackmagic/dx-davinci-resolve/dx.extension.toml",
  "hosts/blackmagic/dx-davinci-resolve/command-plans.json",
  "hosts/blackmagic/dx-davinci-resolve/.gitignore",
  "hosts/blackmagic/dx-davinci-resolve/scripts/dx_command_center.py",
  "hosts/blackmagic/dx-davinci-resolve/scripts/dx_command_center.lua",
  "hosts/blackmagic/dx-davinci-resolve/README.md",
  "hosts/jetbrains/README.md",
  "hosts/jetbrains/dx-intellij-platform/dx.extension.toml",
  "hosts/jetbrains/dx-intellij-platform/settings.gradle.kts",
  "hosts/jetbrains/dx-intellij-platform/build.gradle.kts",
  "hosts/jetbrains/dx-intellij-platform/gradle.properties",
  "hosts/jetbrains/dx-intellij-platform/.gitignore",
  "hosts/jetbrains/dx-intellij-platform/src/main/resources/META-INF/plugin.xml",
  "hosts/jetbrains/dx-intellij-platform/src/main/resources/icons/dx.svg",
  "hosts/jetbrains/dx-intellij-platform/src/main/kotlin/dev/dx/intellij/commands/DxCommandPlans.kt",
  "hosts/jetbrains/dx-intellij-platform/src/main/kotlin/dev/dx/intellij/actions/DxCommandCenterAction.kt",
  "hosts/jetbrains/dx-intellij-platform/src/main/kotlin/dev/dx/intellij/services/DxCommandPlanService.kt",
  "hosts/jetbrains/dx-intellij-platform/src/main/kotlin/dev/dx/intellij/toolwindow/DxToolWindowFactory.kt",
  "hosts/jetbrains/dx-intellij-platform/README.md",
  "hosts/visual-studio/README.md",
  "hosts/visual-studio/dx-visual-studio/dx.extension.toml",
  "hosts/visual-studio/dx-visual-studio/source.extension.vsixmanifest",
  "hosts/visual-studio/dx-visual-studio/Dx.VisualStudio.CommandCenter.csproj",
  "hosts/visual-studio/dx-visual-studio/.gitignore",
  "hosts/visual-studio/dx-visual-studio/src/DxVisualStudioPackage.cs",
  "hosts/visual-studio/dx-visual-studio/src/Commands/CommandIds.cs",
  "hosts/visual-studio/dx-visual-studio/src/Commands/RegisterDxCommands.cs",
  "hosts/visual-studio/dx-visual-studio/src/CommandPlans/DxCommandPlan.cs",
  "hosts/visual-studio/dx-visual-studio/src/CommandPlans/DxCommandPlans.cs",
  "hosts/visual-studio/dx-visual-studio/src/Services/DxLocalServiceBoundary.cs",
  "hosts/visual-studio/dx-visual-studio/src/Receipts/ReceiptPaths.cs",
  "hosts/visual-studio/dx-visual-studio/Resources/DxCommandCenter.vsct",
  "hosts/visual-studio/dx-visual-studio/README.md",
  "hosts/unity/README.md",
  "hosts/unity/dx-unity-editor/dx.extension.toml",
  "hosts/unity/dx-unity-editor/package.json",
  "hosts/unity/dx-unity-editor/.gitignore",
  "hosts/unity/dx-unity-editor/Editor/DX.Unity.Editor.asmdef",
  "hosts/unity/dx-unity-editor/Editor/DxUnityCommandPlans.cs",
  "hosts/unity/dx-unity-editor/Editor/DxUnityLocalServiceBoundary.cs",
  "hosts/unity/dx-unity-editor/Editor/DxUnityMenu.cs",
  "hosts/unity/dx-unity-editor/Editor/DxUnityCommandCenterWindow.cs",
  "hosts/unity/dx-unity-editor/Tests/Editor/DX.Unity.Editor.Tests.asmdef",
  "hosts/unity/dx-unity-editor/README.md",
  "hosts/unreal/README.md",
  "hosts/unreal/dx-unreal-engine/dx.extension.toml",
  "hosts/unreal/dx-unreal-engine/DXUnrealCommandCenter.uplugin",
  "hosts/unreal/dx-unreal-engine/.gitignore",
  "hosts/unreal/dx-unreal-engine/Source/DXUnrealCommandCenterEditor/DXUnrealCommandCenterEditor.Build.cs",
  "hosts/unreal/dx-unreal-engine/Source/DXUnrealCommandCenterEditor/Public/DXUnrealCommandPlans.h",
  "hosts/unreal/dx-unreal-engine/Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandPlans.cpp",
  "hosts/unreal/dx-unreal-engine/Source/DXUnrealCommandCenterEditor/Private/DXUnrealCommandCenterEditorModule.cpp",
  "hosts/unreal/dx-unreal-engine/README.md",
  "hosts/google-workspace/README.md",
  "hosts/google-workspace/dx-google-workspace-addon/dx.extension.toml",
  "hosts/google-workspace/dx-google-workspace-addon/appsscript.json",
  "hosts/google-workspace/dx-google-workspace-addon/.gitignore",
  "hosts/google-workspace/dx-google-workspace-addon/.claspignore",
  "hosts/google-workspace/dx-google-workspace-addon/src/messages.ts",
  "hosts/google-workspace/dx-google-workspace-addon/src/commandPlans.ts",
  "hosts/google-workspace/dx-google-workspace-addon/src/localServiceBoundary.ts",
  "hosts/google-workspace/dx-google-workspace-addon/src/cards.ts",
  "hosts/google-workspace/dx-google-workspace-addon/src/entrypoints.ts",
  "hosts/google-workspace/dx-google-workspace-addon/README.md",
  "hosts/affinity/README.md",
  "hosts/affinity/dx-affinity-content/dx.extension.toml",
  "hosts/affinity/dx-affinity-content/affinity-content-manifest.json",
  "hosts/affinity/dx-affinity-content/.gitignore",
  "hosts/affinity/dx-affinity-content/src/contentPlans.ts",
  "hosts/affinity/dx-affinity-content/src/importGuide.ts",
  "hosts/affinity/dx-affinity-content/README.md",
  "hosts/vscode/dx-vscode/package.json",
  "hosts/vscode/dx-vscode/dx.extension.toml",
  "hosts/vscode/dx-vscode/.vscodeignore",
  "hosts/vscode/dx-vscode/README.md",
  "hosts/vscode/dx-vscode/tests/package.json",
  "hosts/vscode/dx-vscode/tests/loadedHostSmoke.ts",
  "hosts/vscode/dx-vscode/tests/manifestCommandParity.test.ts",
  "docs/command-policy.md",
  "docs/extension-architecture.md",
  "docs/browser-extension.md",
  "docs/figma-plugin-starter.md",
  "docs/canva-app-starter.md",
  "docs/sketch-plugin-starter.md",
  "docs/office-excel-addin-starter.md",
  "docs/office-powerpoint-addin-starter.md",
  "docs/office-word-addin-starter.md",
  "docs/zed-extension-starter.md",
  "docs/photoshop-uxp-plugin-starter.md",
  "docs/premiere-pro-uxp-plugin-starter.md",
  "docs/indesign-uxp-plugin-starter.md",
  "docs/davinci-resolve-scripting-starter.md",
  "docs/intellij-platform-plugin-starter.md",
  "docs/visual-studio-sdk-plugin-starter.md",
  "docs/unity-editor-plugin-starter.md",
  "docs/unreal-engine-plugin-starter.md",
  "docs/google-workspace-addon-starter.md",
  "docs/affinity-content-addon-starter.md",
  "docs/official-extension-starter.md",
  "docs/professional-host-targets.md",
  "scripts/check-browser-j1.ps1",
  "scripts/check-rust-j1.ps1",
  "scripts/check-vscode-j1.ps1",
  "scripts/validate-generated-output-ignore.ts",
  "scripts/generate-manifest-types.ts",
  "scripts/lib/canva-cloud-service-proof.ts",
  "scripts/lib/gzip-tarball-writer.ts",
  "scripts/lib/package-artifact-proof.ts",
  "scripts/lib/package-notarization-proof.ts",
  "scripts/lib/package-output-proof.ts",
  "scripts/lib/stored-zip-writer.ts",
  "scripts/lib/ide-game-engine-special-proof-model.ts",
  "scripts/lib/toml-lite.ts",
  "scripts/lib/local-service-receipt-types.ts",
  "scripts/lib/local-service-receipt-validation.ts",
  "scripts/release-evidence-requirements.ts",
  "scripts/validate-extension-starter-policy.ts",
  "scripts/validate-host-target-catalog.ts",
  "scripts/validate-native-host-command-boundary.ts",
  "scripts/validate-official-registry.ts",
  "scripts/validate-extension-readiness.ts",
  "scripts/validate-release-evidence-gates.ts",
  "scripts/write-source-readiness-receipts.ts",
  "scripts/write-loaded-host-preflight-receipts.ts",
  "scripts/preflight-loaded-host-targets-j1.ps1",
  "scripts/platform-host-discovery-model.ts",
  "scripts/platform-host-discovery-targets.ts",
  "scripts/write-platform-host-discovery-receipts.ts",
  "scripts/preflight-platform-host-discovery-j1.ps1",
  "scripts/write-extension-progress-report.ts",
  "scripts/report-extension-progress-j1.ps1",
  "scripts/write-release-evidence-gap-report.ts",
  "scripts/write-package-notarization-receipt.ts",
  "scripts/smoke-package-notarization-j1.ps1",
  "scripts/lib/release-evidence-core-classifiers.ts",
  "scripts/lib/release-evidence-blocker-mapping.ts",
  "scripts/lib/release-evidence-browser-host-classifier.ts",
  "scripts/lib/release-evidence-host-execution-classifier.ts",
  "scripts/lib/release-evidence-loaded-application-host-classifier.ts",
  "scripts/lib/release-evidence-package-output-classifier.ts",
  "scripts/lib/release-evidence-productivity-host-classifier.ts",
  "scripts/lib/release-evidence-environment-summary.ts",
  "scripts/lib/release-evidence-receipt-primitives.ts",
  "scripts/lib/release-evidence-signed-package-classifier.ts",
  "scripts/lib/release-evidence-special-proof-classifier.ts",
  "scripts/lib/operator-proof-affinity-templates.ts",
  "scripts/lib/operator-proof-application-templates.ts",
  "scripts/lib/operator-proof-browser-templates.ts",
  "scripts/lib/operator-proof-davinci-templates.ts",
  "scripts/lib/operator-proof-design-templates.ts",
  "scripts/lib/operator-proof-google-workspace-templates.ts",
  "scripts/lib/operator-proof-ide-game-engine-templates.ts",
  "scripts/lib/operator-proof-office-templates.ts",
  "scripts/lib/operator-proof-productivity-templates.ts",
  "scripts/lib/operator-proof-template-model.ts",
  "scripts/lib/operator-proof-templates.ts",
  "scripts/lib/operator-proof-vscode-templates.ts",
  "scripts/lib/source-input-proof.ts",
  "scripts/write-operator-proof-template.ts",
  "scripts/require-root-j1-wrapper.ts",
  "scripts/tests/operatorProofTemplate.test.ts",
  "scripts/tests/releaseEvidenceGapReportCoreEvidence.test.ts",
  "scripts/tests/releaseEvidenceGapReportSpecialEvidence.test.ts",
  "scripts/tests/hostPackageScriptPolicy.test.ts",
  "scripts/report-release-evidence-gaps-j1.ps1",
  "scripts/build-affinity-release-package.ts",
  "scripts/package-affinity-release-checksum-j1.ps1",
  "scripts/build-office-google-release-packages.ts",
  "scripts/package-office-google-release-checksum-j1.ps1",
  "scripts/build-package-output-release-packages.ts",
  "scripts/package-package-output-release-checksum-j1.ps1",
  "scripts/write-browser-package-output-receipt.ts",
  "scripts/write-browser-host-action-index-receipt.ts",
  "scripts/write-browser-host-action-index-receipt-j1.ps1",
  "scripts/write-browser-native-host-package-receipt.ts",
  "scripts/package-browser-native-host-j1.ps1",
  "scripts/write-local-service-receipts.ts",
  "scripts/smoke-local-service-j1.ps1",
  "scripts/validate-office-local-service-boundary.ts",
  "scripts/validate-typescript-source-extensions.ts",
  "scripts/verify-vscode-prepublish.ts",
  "scripts/verify-vscode-package.ts",
  "scripts/write-vscode-package-output-receipt.ts",
  "scripts/write-vscode-loaded-host-proof-receipts.ts",
  "scripts/smoke-vscode-loaded-host-j1.ps1",
  "scripts/smoke-vscode-loaded-host-j1.ts",
  "scripts/tests/vscodeLoadedHostProofReceipt.test.ts",
  "scripts/build-canva-j1.ps1",
  "scripts/build-canva-app.ts",
  "scripts/smoke-canva-cloud-service-j1.ps1",
  "scripts/build-figma-j1.ps1",
  "scripts/build-figma-plugin.ts",
  "scripts/write-figma-canva-package-output-receipts.ts",
  "scripts/write-canva-cloud-service-receipt.ts",
  "scripts/build-sketch-j1.ps1",
  "scripts/build-sketch-plugin.ts",
  "scripts/write-sketch-package-output-receipt.ts",
  "scripts/build-blender-j1.ps1",
  "scripts/build-blender-package-output.ts",
  "scripts/write-blender-package-output-receipt.ts",
  "scripts/build-adobe-uxp-j1.ps1",
  "scripts/build-adobe-uxp-package.ts",
  "scripts/write-adobe-uxp-package-output-receipts.ts",
  "scripts/write-adobe-ccx-package-receipts.ts",
  "scripts/package-adobe-ccx-j1.ps1",
  "scripts/write-adobe-uxp-plugin-id-receipt.ts",
  "scripts/smoke-adobe-uxp-plugin-id-j1.ps1",
  "scripts/lib/creative-native-or-hybrid-plugin-proof.ts",
  "scripts/lib/creative-native-or-hybrid-plugin-links.ts",
  "scripts/write-creative-native-or-hybrid-plugin-receipts.ts",
  "scripts/smoke-creative-native-or-hybrid-plugin-j1.ps1",
  "scripts/package-intellij-platform-j1.ps1",
  "scripts/write-intellij-platform-package-output-receipt.ts",
  "scripts/package-davinci-resolve-j1.ps1",
  "scripts/write-davinci-resolve-package-output-receipt.ts",
  "scripts/write-davinci-resolve-developer-docs-receipt.ts",
  "scripts/smoke-davinci-resolve-developer-docs-j1.ps1",
  "scripts/package-visual-studio-j1.ps1",
  "scripts/write-visual-studio-package-output-receipt.ts",
  "scripts/package-unity-editor-j1.ps1",
  "scripts/write-unity-editor-package-output-receipt.ts",
  "scripts/package-unreal-engine-j1.ps1",
  "scripts/write-unreal-engine-package-output-receipt.ts",
  "scripts/write-ide-game-engine-loaded-host-receipts.ts",
  "scripts/write-ide-game-engine-special-proof-receipts.ts",
  "scripts/smoke-ide-game-engine-special-proof-j1.ps1",
  "scripts/build-office-taskpane-j1.ps1",
  "scripts/build-office-taskpane-assets.ts",
  "scripts/build-office-sideload-manifests.ts",
  "scripts/write-office-package-output-receipts.ts",
  "scripts/write-office-sideloaded-host-receipts.ts",
  "scripts/smoke-office-sideloaded-host-j1.ps1",
  "scripts/build-obsidian-j1.ps1",
  "scripts/build-obsidian-plugin.ts",
  "scripts/write-obsidian-package-output-receipt.ts",
  "scripts/build-zed-j1.ps1",
  "scripts/build-zed-extension-output.ts",
  "scripts/package-zed-j1.ps1",
  "scripts/write-zed-package-output-receipt.ts",
  "scripts/build-google-workspace-apps-script-j1.ps1",
  "scripts/build-google-workspace-apps-script-output.ts",
  "scripts/write-google-workspace-apps-script-package-output-receipt.ts",
  "scripts/build-browser-j1.ps1",
  "scripts/install-browser-native-host-j1.ps1",
  "scripts/uninstall-browser-native-host-j1.ps1",
  "scripts/smoke-browser-native-host-j1.ps1",
  "scripts/command-policy.ps1",
  "scripts/tests/officialRegistryValidator.test.ts",
  "scripts/tests/extensionReadinessValidator.test.ts",
  "scripts/tests/releaseEvidenceGateValidator.test.ts",
  "scripts/tests/sourceReadinessReceiptWriter.test.ts",
  "scripts/tests/loadedHostPreflightReceipt.test.ts",
  "scripts/tests/releaseEvidenceEnvironmentSummary.test.ts",
  "scripts/tests/platformHostDiscoveryReceipt.test.ts",
  "scripts/tests/extensionProgressReport.test.ts",
  "scripts/tests/extensionProgressReportAffinityContentPackage.test.ts",
  "scripts/tests/releaseEvidenceGapReport.test.ts",
  "scripts/tests/releaseEvidenceGapReportAffinityContentPackage.test.ts",
  "scripts/tests/releaseEvidenceGapReportBrowserBlockers.test.ts",
  "scripts/tests/releaseEvidenceGapReportBrowserDistributionTargets.test.ts",
  "scripts/tests/releaseEvidenceGapReportAdobePluginIdGate.test.ts",
  "scripts/tests/releaseEvidenceGapReportIdeGameEngineProof.test.ts",
  "scripts/tests/releaseEvidenceGapReportIdeGameEngineEnvironment.test.ts",
  "scripts/tests/releaseEvidenceGapReportOfficeLocalService.test.ts",
  "scripts/tests/releaseEvidenceGapReportSigningReviewFreshness.test.ts",
  "scripts/tests/packageNotarizationReceipt.test.ts",
  "scripts/tests/affinityReleasePackageChecksum.test.ts",
  "scripts/tests/officeGoogleReleasePackageChecksum.test.ts",
  "scripts/tests/packageOutputReleasePackageChecksum.test.ts",
  "scripts/tests/officialExtensionStarterPolicy.test.ts",
  "scripts/tests/professionalHostTargetCatalog.test.ts",
  "scripts/tests/browserPackageOutputReceipt.test.ts",
  "scripts/tests/browserHostActionIndexReceipt.test.ts",
  "scripts/tests/browserNativeHostPackageReceipt.test.ts",
  "scripts/tests/localServiceReceipt.test.ts",
  "scripts/tests/nativeHostCommandBoundary.test.ts",
  "scripts/tests/commandPolicyRuntimeGuard.test.ts",
  "scripts/tests/generatedOutputIgnore.test.ts",
  "scripts/tests/typescriptSourceExtensionPolicy.test.ts",
  "scripts/tests/vscodeLoadedHostSmoke.test.ts",
  "scripts/tests/vscodePackageOutputReceipt.test.ts",
  "scripts/tests/blenderAdapter.test.ts",
  "scripts/tests/blenderPackageOutput.test.ts",
  "scripts/tests/blenderPackageOutputReceipt.test.ts",
  "scripts/tests/obsidianAdapter.test.ts",
  "scripts/tests/obsidianBuildOutput.test.ts",
  "scripts/tests/obsidianPackageOutputReceipt.test.ts",
  "scripts/tests/figmaAdapter.test.ts",
  "scripts/tests/figmaBuildOutput.test.ts",
  "scripts/tests/canvaAdapter.test.ts",
  "scripts/tests/canvaBuildOutput.test.ts",
  "scripts/tests/canvaCloudServiceReceipt.test.ts",
  "scripts/tests/figmaCanvaPackageOutputReceipt.test.ts",
  "scripts/tests/sketchAdapter.test.ts",
  "scripts/tests/sketchBuildOutput.test.ts",
  "scripts/tests/sketchPackageOutputReceipt.test.ts",
  "scripts/tests/officeLocalServiceBoundary.test.ts",
  "scripts/tests/officeTaskpaneAssetOutput.test.ts",
  "scripts/tests/officeSideloadManifestOutput.test.ts",
  "scripts/tests/officePackageOutputReceipt.test.ts",
  "scripts/tests/excelAdapter.test.ts",
  "scripts/tests/powerpointAdapter.test.ts",
  "scripts/tests/wordAdapter.test.ts",
  "scripts/tests/zedAdapter.test.ts",
  "scripts/tests/zedBuildOutput.test.ts",
  "scripts/tests/zedPackageOutputReceipt.test.ts",
  "scripts/tests/photoshopAdapter.test.ts",
  "scripts/tests/premiereProAdapter.test.ts",
  "scripts/tests/indesignAdapter.test.ts",
  "scripts/tests/adobeUxpPackageOutput.test.ts",
  "scripts/tests/adobeUxpPackageOutputReceipt.test.ts",
  "scripts/tests/adobeCcxPackageReceipt.test.ts",
  "scripts/tests/adobeUxpPluginIdReceipt.test.ts",
  "scripts/tests/creativeNativeOrHybridPluginReceipt.test.ts",
  "scripts/tests/davinciResolveAdapter.test.ts",
  "scripts/tests/davinciResolvePackageOutputReceipt.test.ts",
  "scripts/tests/davinciResolveDeveloperDocsReceipt.test.ts",
  "scripts/tests/davinciResolveDeveloperDocsWrapper.test.ts",
  "scripts/tests/intellijPlatformPluginAdapter.test.ts",
  "scripts/tests/intellijPlatformPackageOutputReceipt.test.ts",
  "scripts/tests/visualStudioSdkPluginAdapter.test.ts",
  "scripts/tests/visualStudioPackageOutputReceipt.test.ts",
  "scripts/tests/unityEditorPluginAdapter.test.ts",
  "scripts/tests/unityEditorPackageOutputReceipt.test.ts",
  "scripts/tests/unrealEnginePluginAdapter.test.ts",
  "scripts/tests/unrealEnginePackageOutputReceipt.test.ts",
  "scripts/tests/ideGameEngineLoadedHostReceipt.test.ts",
  "scripts/tests/ideGameEngineSpecialProofReceipt.test.ts",
  "scripts/tests/googleWorkspaceAddonAdapter.test.ts",
  "scripts/tests/googleWorkspaceAppsScriptOutput.test.ts",
  "scripts/tests/googleWorkspaceAppsScriptPackageOutputReceipt.test.ts",
  "scripts/tests/affinityContentAddonAdapter.test.ts"
];

const failures = [];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`missing required path: ${relativePath}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
validateNodeEngine("package.json", packageJson);
validatePackageScripts("package.json", packageJson.scripts ?? {}, true);
validateRootGuardedShortcuts(packageJson.scripts ?? {});
validateManifestTypeScripts(packageJson.scripts ?? {});
validateLockfile(packageJson.workspaces ?? []);
validateBuildOutputContract();
validateBrowserNativeHostSmokeContract();
validateBrowserNativeHostInstallProofContract();
validateManifestTypesCurrent();
validateBrowserManifestCapabilityParity();
failures.push(...validateOfficialExtensionRegistry(root));
failures.push(...validateExtensionReadiness(root));
failures.push(...validateOfficialExtensionStarterPolicy(root));
failures.push(...validateGeneratedOutputIgnore(root));
failures.push(...validateProfessionalHostTargetCatalog(root));
failures.push(...validateNativeHostCommandBoundary(root));
failures.push(...validateOfficeLocalServiceBoundary(root));
failures.push(...validateTypescriptSourceExtensions(root));

for (const relativePath of findPackageJsonFiles(root)) {
  if (relativePath === "package.json") {
    continue;
  }

  const manifest = JSON.parse(readFileSync(join(root, relativePath), "utf8"));
  validateNodeEngine(relativePath, manifest);
  validatePackageScripts(relativePath, manifest.scripts ?? {}, false);
}

for (const relativePath of findScriptFiles(root)) {
  validateScriptSource(relativePath);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("workspace metadata verified");

function validateNodeEngine(relativePath, manifest) {
  if (manifest.engines?.node === undefined) {
    return;
  }

  if (manifest.engines.node !== requiredNodeEngine) {
    failures.push(
      `${relativePath} engines.node must be ${requiredNodeEngine} for native TypeScript script execution`
    );
  }
}

function validatePackageScripts(relativePath, scripts, isRoot) {
  const internalGuardCommand = "node --experimental-strip-types ../../../scripts/require-root-j1-wrapper.ts && ";
  const forbiddenLocalScriptNames = new Set([
    "check:local",
    "build:local",
    "build:artifacts:local",
    "package:local",
    "test:local"
  ]);

  if (
    relativePath === "hosts/vscode/dx-vscode/package.json" &&
    scripts["vscode:prepublish"] !==
      "node --experimental-strip-types ../../../scripts/verify-vscode-prepublish.ts package.json"
  ) {
    failures.push(
      `${relativePath} script vscode:prepublish must require the guarded prepublish check`
    );
  }

  if (
    relativePath === "hosts/browser/dx-browser/package.json" &&
    scripts["test:native-host-install-proof"] !==
      "node --experimental-strip-types tests/nativeHostInstallProof.test.ts"
  ) {
    failures.push(
      `${relativePath} script test:native-host-install-proof must run the manifest install proof`
    );
  }

  if (
    relativePath === "hosts/browser/dx-browser/package.json" &&
    scripts["test:native-host-shell-install-proof"] !==
      "node --experimental-strip-types tests/nativeHostShellInstallProof.test.ts"
  ) {
    failures.push(
      `${relativePath} script test:native-host-shell-install-proof must run the shell manifest install proof`
    );
  }

  if (
    relativePath === "hosts/browser/dx-browser/package.json" &&
    scripts["test:native-host-shell-uninstall-proof"] !==
      "node --experimental-strip-types tests/nativeHostShellUninstallProof.test.ts"
  ) {
    failures.push(
      `${relativePath} script test:native-host-shell-uninstall-proof must run the shell manifest uninstall proof`
    );
  }

  if (
    relativePath === "hosts/browser/dx-browser/package.json" &&
    scripts["test:loaded-browser-command-smoke"] !==
      "npm run compile && node --experimental-strip-types tests/loadedBrowserCommandSmoke.test.ts"
  ) {
    failures.push(
      `${relativePath} script test:loaded-browser-command-smoke must run the loaded browser command smoke`
    );
  }

  if (
    relativePath === "hosts/browser/dx-browser/package.json" &&
    scripts["test:loaded-browser-dispatch-smoke"] !==
      "npm run compile && node --experimental-strip-types tests/loadedBrowserDispatchSmoke.test.ts"
  ) {
    failures.push(
      `${relativePath} script test:loaded-browser-dispatch-smoke must run the loaded browser dispatch smoke`
    );
  }

  if (
    relativePath === "hosts/browser/dx-browser/package.json" &&
    (!(scripts["internal:check"] ?? "").includes("npm run test:native-host-install-proof") ||
      !(scripts["internal:check"] ?? "").includes("npm run test:native-host-shell-install-proof") ||
      !(scripts["internal:check"] ?? "").includes("npm run test:native-host-shell-uninstall-proof") ||
      !(scripts["internal:check"] ?? "").includes("npm run test:loaded-browser-command-smoke"))
  ) {
    failures.push(
      `${relativePath} script internal:check must include the manifest install proofs and loaded browser command smoke`
    );
  }

  for (const [name, command] of Object.entries(scripts)) {
    if (!isRoot && forbiddenLocalScriptNames.has(name)) {
      failures.push(`${relativePath} script ${name} must be replaced by a guarded internal script`);
    }

    if (!isRoot && name.startsWith("internal:") && !command.startsWith(internalGuardCommand)) {
      failures.push(`${relativePath} script ${name} must require the root j1 wrapper guard`);
    }

    if (/cargo (build|check|test|clippy)/.test(command) && !command.includes("-j 1")) {
      failures.push(`${relativePath} script ${name} must run cargo with -j 1`);
    }

    if (/concurrently|npm-run-all\s+(-p|--parallel)|pnpm\s+-r|turbo\b|nx\s+run-many|Start-Job/i.test(command)) {
      failures.push(`${relativePath} script ${name} must not use parallel runners`);
    }

    if (/\bnpm\s+--workspaces\b.*\brun\b.*\b(build|check|test|package)\b/.test(command)) {
      failures.push(`${relativePath} script ${name} must not fan out across all npm workspaces`);
    }

    if (!isRoot && /\bvsce\s+package\b/.test(command)) {
      failures.push(`${relativePath} script ${name} must route VS Code packaging through the root j1 wrapper`);
    }

    if (!isRoot && name.includes("package") && /\bnpm\s+run\s+.+&&/.test(command)) {
      failures.push(`${relativePath} script ${name} must avoid chained package fan-out`);
    }
  }
}

function validateManifestTypeScripts(scripts) {
  if (scripts["generate:manifest-types"] !== "node --experimental-strip-types scripts/generate-manifest-types.ts") {
    failures.push("package.json must expose generate:manifest-types");
  }

  if (
    scripts["check:manifest-types"] !==
    "node --experimental-strip-types scripts/generate-manifest-types.ts --check"
  ) {
    failures.push("package.json must expose check:manifest-types");
  }

  if (
    scripts["test:official-registry"] !==
    "node --experimental-strip-types scripts/tests/officialRegistryValidator.test.ts"
  ) {
    failures.push("package.json must expose test:official-registry");
  }

  if (
    scripts["check:official-registry"] !==
    "npm run test:official-registry && node --experimental-strip-types scripts/validate-official-registry.ts"
  ) {
    failures.push("package.json must expose check:official-registry");
  }

  if (
    scripts["test:extension-readiness"] !==
    "node --experimental-strip-types scripts/tests/extensionReadinessValidator.test.ts"
  ) {
    failures.push("package.json must expose test:extension-readiness");
  }

  if (
    scripts["test:source-readiness-receipts"] !==
    "node --experimental-strip-types scripts/tests/sourceReadinessReceiptWriter.test.ts"
  ) {
    failures.push("package.json must expose test:source-readiness-receipts");
  }

  if (
    scripts["write:source-readiness-receipts"] !==
    "node --experimental-strip-types scripts/write-source-readiness-receipts.ts"
  ) {
    failures.push("package.json must expose write:source-readiness-receipts");
  }

  if (
    scripts["test:operator-proof-template"] !==
    "node --experimental-strip-types scripts/tests/operatorProofTemplate.test.ts"
  ) {
    failures.push("package.json must expose test:operator-proof-template");
  }

  if (
    scripts["write:operator-proof-template"] !==
    "node --experimental-strip-types scripts/write-operator-proof-template.ts"
  ) {
    failures.push("package.json must expose write:operator-proof-template");
  }

  if (
    scripts["test:loaded-host-preflight-receipts"] !==
    "node --experimental-strip-types scripts/tests/loadedHostPreflightReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:loaded-host-preflight-receipts");
  }

  if (
    scripts["test:release-evidence-environment-summary"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceEnvironmentSummary.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-environment-summary");
  }

  if (scripts["preflight:loaded-host-targets"] !== "npm run preflight:loaded-host-targets:j1") {
    failures.push("package.json must expose preflight:loaded-host-targets");
  }

  if (
    scripts["preflight:loaded-host-targets:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/preflight-loaded-host-targets-j1.ps1"
  ) {
    failures.push("package.json must expose preflight:loaded-host-targets:j1");
  }

  if (
    scripts["test:platform-host-discovery-receipts"] !==
    "node --experimental-strip-types scripts/tests/platformHostDiscoveryReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:platform-host-discovery-receipts");
  }

  if (scripts["preflight:platform-host-discovery"] !== "npm run preflight:platform-host-discovery:j1") {
    failures.push("package.json must expose preflight:platform-host-discovery");
  }

  if (
    scripts["preflight:platform-host-discovery:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/preflight-platform-host-discovery-j1.ps1"
  ) {
    failures.push("package.json must expose preflight:platform-host-discovery:j1");
  }

  if (
    scripts["test:extension-progress-report"] !==
    "node --experimental-strip-types scripts/tests/extensionProgressReport.test.ts"
  ) {
    failures.push("package.json must expose test:extension-progress-report");
  }

  if (
    scripts["test:extension-progress-report-affinity-content"] !==
    "node --experimental-strip-types scripts/tests/extensionProgressReportAffinityContentPackage.test.ts"
  ) {
    failures.push("package.json must expose test:extension-progress-report-affinity-content");
  }

  if (scripts["report:extension-progress"] !== "npm run report:extension-progress:j1") {
    failures.push("package.json must expose report:extension-progress");
  }

  if (
    scripts["report:extension-progress:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/report-extension-progress-j1.ps1"
  ) {
    failures.push("package.json must expose report:extension-progress:j1");
  }

  if (
    scripts["test:release-evidence-gates"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGateValidator.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gates");
  }

  if (
    scripts["check:release-evidence-gates"] !==
    "npm run test:release-evidence-gates && node --experimental-strip-types scripts/validate-release-evidence-gates.ts"
  ) {
    failures.push("package.json must expose check:release-evidence-gates");
  }

  if (
    scripts["test:release-evidence-gap-report"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReport.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report");
  }

  if (
    scripts["test:release-evidence-gap-report-affinity-content-package"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportAffinityContentPackage.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-affinity-content-package");
  }

  if (
    scripts["test:release-evidence-gap-report-browser-blockers"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportBrowserBlockers.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-browser-blockers");
  }

  if (
    scripts["test:release-evidence-gap-report-browser-distribution-targets"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportBrowserDistributionTargets.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-browser-distribution-targets");
  }

  if (
    scripts["test:release-evidence-gap-report-adobe-plugin-id-gate"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportAdobePluginIdGate.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-adobe-plugin-id-gate");
  }

  if (
    scripts["test:release-evidence-gap-report-core-evidence"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportCoreEvidence.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-core-evidence");
  }

  if (
    scripts["test:release-evidence-gap-report-ide-game-engine"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportIdeGameEngineProof.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-ide-game-engine");
  }

  if (
    scripts["test:release-evidence-gap-report-ide-game-engine-environment"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportIdeGameEngineEnvironment.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-ide-game-engine-environment");
  }

  if (
    scripts["test:release-evidence-gap-report-office-local-service"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportOfficeLocalService.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-office-local-service");
  }

  if (
    scripts["test:release-evidence-gap-report-special-evidence"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportSpecialEvidence.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-special-evidence");
  }

  if (
    scripts["test:release-evidence-gap-report-signing-review-freshness"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportSigningReviewFreshness.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-signing-review-freshness");
  }

  if (scripts["report:release-evidence-gaps"] !== "npm run report:release-evidence-gaps:j1") {
    failures.push("package.json must expose report:release-evidence-gaps");
  }

  if (
    scripts["report:release-evidence-gaps:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/report-release-evidence-gaps-j1.ps1"
  ) {
    failures.push("package.json must expose report:release-evidence-gaps:j1");
  }

  if (
    scripts["check:extension-readiness"] !==
    "npm run test:extension-readiness && node --experimental-strip-types scripts/validate-extension-readiness.ts"
  ) {
    failures.push("package.json must expose check:extension-readiness");
  }

  if (
    scripts["check:source-readiness-receipts"] !==
    "npm run test:source-readiness-receipts && node --experimental-strip-types scripts/write-source-readiness-receipts.ts --dry-run"
  ) {
    failures.push("package.json must expose check:source-readiness-receipts");
  }

  if (
    scripts["test:extension-starter"] !==
    "node --experimental-strip-types scripts/tests/officialExtensionStarterPolicy.test.ts"
  ) {
    failures.push("package.json must expose test:extension-starter");
  }

  if (
    scripts["check:extension-starter"] !==
    "npm run test:extension-starter && node --experimental-strip-types scripts/validate-extension-starter-policy.ts"
  ) {
    failures.push("package.json must expose check:extension-starter");
  }

  if (
    scripts["test:professional-host-targets"] !==
    "node --experimental-strip-types scripts/tests/professionalHostTargetCatalog.test.ts"
  ) {
    failures.push("package.json must expose test:professional-host-targets");
  }

  if (
    scripts["check:professional-host-targets"] !==
    "npm run test:professional-host-targets && node --experimental-strip-types scripts/validate-host-target-catalog.ts"
  ) {
    failures.push("package.json must expose check:professional-host-targets");
  }

  if (
    scripts["test:browser-host-action-index-receipt"] !==
    "node --experimental-strip-types scripts/tests/browserHostActionIndexReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:browser-host-action-index-receipt");
  }

  if (scripts["write:browser-host-action-index-receipt"] !== "npm run write:browser-host-action-index-receipt:j1") {
    failures.push("package.json must expose write:browser-host-action-index-receipt");
  }

  if (
    scripts["write:browser-host-action-index-receipt:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/write-browser-host-action-index-receipt-j1.ps1"
  ) {
    failures.push("package.json must expose write:browser-host-action-index-receipt:j1");
  }

  if (
    scripts["test:browser-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/browserPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:browser-package-output-receipt");
  }

  if (
    scripts["test:browser-loaded-profile-receipt"] !==
    "node --experimental-strip-types scripts/tests/browserLoadedProfileReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:browser-loaded-profile-receipt");
  }

  if (
    scripts["test:browser-extension-id-capture"] !==
    "node --experimental-strip-types scripts/tests/browserExtensionIdCapture.test.ts"
  ) {
    failures.push("package.json must expose test:browser-extension-id-capture");
  }

  if (
    scripts["test:browser-loaded-profile-smoke-runner"] !==
    "node --experimental-strip-types scripts/tests/browserLoadedProfileSmokeRunner.test.ts"
  ) {
    failures.push("package.json must expose test:browser-loaded-profile-smoke-runner");
  }

  if (
    scripts["test:release-evidence-gap-report-ide-game-engine-loaded-host"] !==
    "node --experimental-strip-types scripts/tests/releaseEvidenceGapReportIdeGameEngineLoadedHost.test.ts"
  ) {
    failures.push("package.json must expose test:release-evidence-gap-report-ide-game-engine-loaded-host");
  }

  if (scripts["package:affinity-release-checksum"] !== "npm run package:affinity-release-checksum:j1") {
    failures.push("package.json must expose package:affinity-release-checksum");
  }

  if (
    scripts["package:affinity-release-checksum:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-affinity-release-checksum-j1.ps1"
  ) {
    failures.push("package.json must expose package:affinity-release-checksum:j1");
  }

  if (
    scripts["test:affinity-release-package-checksum"] !==
    "node --experimental-strip-types scripts/tests/affinityReleasePackageChecksum.test.ts"
  ) {
    failures.push("package.json must expose test:affinity-release-package-checksum");
  }

  if (
    scripts["package:office-google-release-checksum"] !==
    "npm run package:office-google-release-checksum:j1"
  ) {
    failures.push("package.json must expose package:office-google-release-checksum");
  }

  if (
    scripts["package:office-google-release-checksum:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-office-google-release-checksum-j1.ps1"
  ) {
    failures.push("package.json must expose package:office-google-release-checksum:j1");
  }

  if (
    scripts["test:office-google-release-package-checksum"] !==
    "node --experimental-strip-types scripts/tests/officeGoogleReleasePackageChecksum.test.ts"
  ) {
    failures.push("package.json must expose test:office-google-release-package-checksum");
  }

  if (
    scripts["package:package-output-release-checksum"] !== "npm run package:package-output-release-checksum:j1"
  ) {
    failures.push("package.json must expose package:package-output-release-checksum");
  }

  if (
    scripts["package:package-output-release-checksum:j1"] !==
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-package-output-release-checksum-j1.ps1"
  ) {
    failures.push("package.json must expose package:package-output-release-checksum:j1");
  }

  if (
    scripts["test:package-output-release-package-checksum"] !==
    "node --experimental-strip-types scripts/tests/packageOutputReleasePackageChecksum.test.ts"
  ) {
    failures.push("package.json must expose test:package-output-release-package-checksum");
  }

  if (
    scripts["test:browser-native-host-package-receipt"] !==
    "node --experimental-strip-types scripts/tests/browserNativeHostPackageReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:browser-native-host-package-receipt");
  }

  if (
    scripts["test:local-service-receipts"] !==
    "node --experimental-strip-types scripts/tests/localServiceReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:local-service-receipts");
  }

  if (
    scripts["test:package-notarization-receipt"] !==
    "node --experimental-strip-types scripts/tests/packageNotarizationReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:package-notarization-receipt");
  }

  if (
    scripts["test:native-host-command-boundary"] !==
    "node --experimental-strip-types scripts/tests/nativeHostCommandBoundary.test.ts"
  ) {
    failures.push("package.json must expose test:native-host-command-boundary");
  }

  if (
    scripts["check:native-host-command-boundary"] !==
    "npm run test:native-host-command-boundary && node --experimental-strip-types scripts/validate-native-host-command-boundary.ts"
  ) {
    failures.push("package.json must expose check:native-host-command-boundary");
  }

  if (
    scripts["test:command-policy-runtime"] !==
    "node --experimental-strip-types scripts/tests/commandPolicyRuntimeGuard.test.ts"
  ) {
    failures.push("package.json must expose test:command-policy-runtime");
  }

  if (
    scripts["test:host-package-script-policy"] !==
    "node --experimental-strip-types scripts/tests/hostPackageScriptPolicy.test.ts"
  ) {
    failures.push("package.json must expose test:host-package-script-policy");
  }

  if (
    scripts["test:j1-wrapper-process-guards"] !==
    "node --experimental-strip-types scripts/tests/j1WrapperProcessGuard.test.ts"
  ) {
    failures.push("package.json must expose test:j1-wrapper-process-guards");
  }

  if (
    scripts["test:typescript-source-extensions"] !==
    "node --experimental-strip-types scripts/tests/typescriptSourceExtensionPolicy.test.ts"
  ) {
    failures.push("package.json must expose test:typescript-source-extensions");
  }

  if (
    scripts["test:generated-output-ignore"] !==
    "node --experimental-strip-types scripts/tests/generatedOutputIgnore.test.ts"
  ) {
    failures.push("package.json must expose test:generated-output-ignore");
  }

  if (
    scripts["check:generated-output-ignore"] !==
    "npm run test:generated-output-ignore && node --experimental-strip-types scripts/validate-generated-output-ignore.ts"
  ) {
    failures.push("package.json must expose check:generated-output-ignore");
  }

  if (
    scripts["test:vscode-loaded-host-smoke"] !==
    "node --experimental-strip-types scripts/tests/vscodeLoadedHostSmoke.test.ts"
  ) {
    failures.push("package.json must expose test:vscode-loaded-host-smoke");
  }

  if (
    scripts["test:vscode-loaded-host-proof-receipts"] !==
    "node --experimental-strip-types scripts/tests/vscodeLoadedHostProofReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:vscode-loaded-host-proof-receipts");
  }

  if (
    scripts["test:vscode-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/vscodePackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:vscode-package-output-receipt");
  }

  if (
    scripts["check:typescript-source-extensions"] !==
    "npm run test:typescript-source-extensions && node --experimental-strip-types scripts/validate-typescript-source-extensions.ts"
  ) {
    failures.push("package.json must expose check:typescript-source-extensions");
  }

  if (scripts["test:blender-adapter"] !== "node --experimental-strip-types scripts/tests/blenderAdapter.test.ts") {
    failures.push("package.json must expose test:blender-adapter");
  }

  if (
    scripts["test:blender-package-output"] !==
    "node --experimental-strip-types scripts/tests/blenderPackageOutput.test.ts"
  ) {
    failures.push("package.json must expose test:blender-package-output");
  }

  if (
    scripts["test:blender-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/blenderPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:blender-package-output-receipt");
  }

  if (scripts["test:obsidian-adapter"] !== "node --experimental-strip-types scripts/tests/obsidianAdapter.test.ts") {
    failures.push("package.json must expose test:obsidian-adapter");
  }

  if (
    scripts["test:obsidian-build-output"] !==
    "node --experimental-strip-types scripts/tests/obsidianBuildOutput.test.ts"
  ) {
    failures.push("package.json must expose test:obsidian-build-output");
  }

  if (
    scripts["test:obsidian-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/obsidianPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:obsidian-package-output-receipt");
  }

  if (scripts["test:figma-adapter"] !== "node --experimental-strip-types scripts/tests/figmaAdapter.test.ts") {
    failures.push("package.json must expose test:figma-adapter");
  }

  if (
    scripts["test:figma-build-output"] !==
    "node --experimental-strip-types scripts/tests/figmaBuildOutput.test.ts"
  ) {
    failures.push("package.json must expose test:figma-build-output");
  }

  if (scripts["test:canva-adapter"] !== "node --experimental-strip-types scripts/tests/canvaAdapter.test.ts") {
    failures.push("package.json must expose test:canva-adapter");
  }

  if (
    scripts["test:canva-build-output"] !==
    "node --experimental-strip-types scripts/tests/canvaBuildOutput.test.ts"
  ) {
    failures.push("package.json must expose test:canva-build-output");
  }

  if (
    scripts["test:figma-canva-package-output-receipts"] !==
    "node --experimental-strip-types scripts/tests/figmaCanvaPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:figma-canva-package-output-receipts");
  }

  if (
    scripts["test:canva-cloud-service-receipt"] !==
    "node --experimental-strip-types scripts/tests/canvaCloudServiceReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:canva-cloud-service-receipt");
  }

  if (scripts["test:sketch-adapter"] !== "node --experimental-strip-types scripts/tests/sketchAdapter.test.ts") {
    failures.push("package.json must expose test:sketch-adapter");
  }

  if (
    scripts["test:sketch-build-output"] !==
    "node --experimental-strip-types scripts/tests/sketchBuildOutput.test.ts"
  ) {
    failures.push("package.json must expose test:sketch-build-output");
  }

  if (
    scripts["test:sketch-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/sketchPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:sketch-package-output-receipt");
  }

  if (
    scripts["test:office-local-service-boundary"] !==
    "node --experimental-strip-types scripts/tests/officeLocalServiceBoundary.test.ts"
  ) {
    failures.push("package.json must expose test:office-local-service-boundary");
  }

  if (
    scripts["check:office-local-service-boundary"] !==
    "npm run test:office-local-service-boundary && node --experimental-strip-types scripts/validate-office-local-service-boundary.ts"
  ) {
    failures.push("package.json must expose check:office-local-service-boundary");
  }

  if (
    scripts["test:office-taskpane-asset-output"] !==
    "node --experimental-strip-types scripts/tests/officeTaskpaneAssetOutput.test.ts"
  ) {
    failures.push("package.json must expose test:office-taskpane-asset-output");
  }

  if (
    scripts["test:office-sideload-manifest-output"] !==
    "node --experimental-strip-types scripts/tests/officeSideloadManifestOutput.test.ts"
  ) {
    failures.push("package.json must expose test:office-sideload-manifest-output");
  }

  if (
    scripts["test:office-package-output-receipts"] !==
    "node --experimental-strip-types scripts/tests/officePackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:office-package-output-receipts");
  }

  if (
    scripts["test:office-sideloaded-host-receipts"] !==
    "node --experimental-strip-types scripts/tests/officeSideloadedHostReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:office-sideloaded-host-receipts");
  }

  if (scripts["test:excel-adapter"] !== "node --experimental-strip-types scripts/tests/excelAdapter.test.ts") {
    failures.push("package.json must expose test:excel-adapter");
  }

  if (scripts["test:powerpoint-adapter"] !== "node --experimental-strip-types scripts/tests/powerpointAdapter.test.ts") {
    failures.push("package.json must expose test:powerpoint-adapter");
  }

  if (scripts["test:word-adapter"] !== "node --experimental-strip-types scripts/tests/wordAdapter.test.ts") {
    failures.push("package.json must expose test:word-adapter");
  }

  if (scripts["test:zed-adapter"] !== "node --experimental-strip-types scripts/tests/zedAdapter.test.ts") {
    failures.push("package.json must expose test:zed-adapter");
  }

  if (scripts["test:zed-build-output"] !== "node --experimental-strip-types scripts/tests/zedBuildOutput.test.ts") {
    failures.push("package.json must expose test:zed-build-output");
  }

  if (
    scripts["test:zed-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/zedPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:zed-package-output-receipt");
  }

  if (scripts["test:photoshop-adapter"] !== "node --experimental-strip-types scripts/tests/photoshopAdapter.test.ts") {
    failures.push("package.json must expose test:photoshop-adapter");
  }

  if (
    scripts["test:premiere-pro-adapter"] !==
    "node --experimental-strip-types scripts/tests/premiereProAdapter.test.ts"
  ) {
    failures.push("package.json must expose test:premiere-pro-adapter");
  }

  if (
    scripts["test:indesign-adapter"] !==
    "node --experimental-strip-types scripts/tests/indesignAdapter.test.ts"
  ) {
    failures.push("package.json must expose test:indesign-adapter");
  }

  if (
    scripts["test:adobe-uxp-package-output"] !==
    "node --experimental-strip-types scripts/tests/adobeUxpPackageOutput.test.ts"
  ) {
    failures.push("package.json must expose test:adobe-uxp-package-output");
  }

  if (
    scripts["test:adobe-uxp-package-output-receipts"] !==
    "node --experimental-strip-types scripts/tests/adobeUxpPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:adobe-uxp-package-output-receipts");
  }

  if (
    scripts["test:adobe-ccx-package-receipts"] !==
    "node --experimental-strip-types scripts/tests/adobeCcxPackageReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:adobe-ccx-package-receipts");
  }

  if (
    scripts["test:adobe-uxp-plugin-id-receipt"] !==
    "node --experimental-strip-types scripts/tests/adobeUxpPluginIdReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:adobe-uxp-plugin-id-receipt");
  }

  if (
    scripts["test:creative-native-or-hybrid-plugin-receipts"] !==
    "node --experimental-strip-types scripts/tests/creativeNativeOrHybridPluginReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:creative-native-or-hybrid-plugin-receipts");
  }

  if (
    scripts["test:davinci-resolve-adapter"] !==
    "node --experimental-strip-types scripts/tests/davinciResolveAdapter.test.ts"
  ) {
    failures.push("package.json must expose test:davinci-resolve-adapter");
  }

  if (
    scripts["test:davinci-resolve-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/davinciResolvePackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:davinci-resolve-package-output-receipt");
  }

  if (
    scripts["test:davinci-resolve-developer-docs-receipt"] !==
    "node --experimental-strip-types scripts/tests/davinciResolveDeveloperDocsReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:davinci-resolve-developer-docs-receipt");
  }

  if (
    scripts["test:davinci-resolve-developer-docs-wrapper"] !==
    "node --experimental-strip-types scripts/tests/davinciResolveDeveloperDocsWrapper.test.ts"
  ) {
    failures.push("package.json must expose test:davinci-resolve-developer-docs-wrapper");
  }

  if (
    scripts["test:intellij-platform-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/intellijPlatformPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:intellij-platform-package-output-receipt");
  }

  if (
    scripts["test:visual-studio-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/visualStudioPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:visual-studio-package-output-receipt");
  }

  if (
    scripts["test:google-workspace-apps-script-output"] !==
    "node --experimental-strip-types scripts/tests/googleWorkspaceAppsScriptOutput.test.ts"
  ) {
    failures.push("package.json must expose test:google-workspace-apps-script-output");
  }

  if (
    scripts["test:google-workspace-apps-script-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/googleWorkspaceAppsScriptPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:google-workspace-apps-script-package-output-receipt");
  }

  if (
    scripts["test:unity-editor-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/unityEditorPackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:unity-editor-package-output-receipt");
  }

  if (
    scripts["test:unreal-engine-package-output-receipt"] !==
    "node --experimental-strip-types scripts/tests/unrealEnginePackageOutputReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:unreal-engine-package-output-receipt");
  }

  if (
    scripts["test:ide-game-engine-special-proof-receipts"] !==
    "node --experimental-strip-types scripts/tests/ideGameEngineSpecialProofReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:ide-game-engine-special-proof-receipts");
  }

  if (
    scripts["test:affinity-content-package-output"] !==
    "node --experimental-strip-types scripts/tests/affinityContentPackageOutput.test.ts"
  ) {
    failures.push("package.json must expose test:affinity-content-package-output");
  }

  if (
    scripts["test:affinity-content-package-receipt"] !==
    "node --experimental-strip-types scripts/tests/affinityContentPackageReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:affinity-content-package-receipt");
  }

  if (
    scripts["test:affinity-manual-import-receipt"] !==
    "node --experimental-strip-types scripts/tests/affinityManualImportReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:affinity-manual-import-receipt");
  }

  if (
    scripts["test:affinity-loaded-app-receipt"] !==
    "node --experimental-strip-types scripts/tests/affinityLoadedAppReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:affinity-loaded-app-receipt");
  }

  if (
    scripts["test:affinity-photoshop-filter-plugin-receipt"] !==
    "node --experimental-strip-types scripts/tests/affinityPhotoshopFilterPluginReceipt.test.ts"
  ) {
    failures.push("package.json must expose test:affinity-photoshop-filter-plugin-receipt");
  }
}

function validateRootGuardedShortcuts(scripts) {
  const expectedScripts = {
    "package:vscode:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-vscode-j1.ps1",
    "package:browser-native-host": "npm run package:browser-native-host:j1",
    "package:browser-native-host:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-browser-native-host-j1.ps1",
    "write:browser-host-action-index-receipt": "npm run write:browser-host-action-index-receipt:j1",
    "write:browser-host-action-index-receipt:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/write-browser-host-action-index-receipt-j1.ps1",
    "package:intellij-platform": "npm run package:intellij-platform:j1",
    "package:intellij-platform:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-intellij-platform-j1.ps1",
    "package:zed": "npm run package:zed:j1",
    "package:zed:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-zed-j1.ps1",
    "check:browser": "npm run check:browser:j1",
    "check:browser:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-browser-j1.ps1",
    "check:rust": "npm run check:rust:j1",
    "check:rust:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-rust-j1.ps1",
    "check:vscode": "npm run check:vscode:j1",
    "check:vscode:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-vscode-j1.ps1",
    "smoke:browser-native-host": "npm run smoke:browser-native-host:j1",
    "smoke:browser-native-host:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-browser-native-host-j1.ps1",
    "smoke:package-notarization": "npm run smoke:package-notarization:j1",
    "smoke:package-notarization:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-package-notarization-j1.ps1",
    "smoke:vscode-loaded-host": "npm run smoke:vscode-loaded-host:j1",
    "smoke:vscode-loaded-host:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-vscode-loaded-host-j1.ps1",
    "smoke:ide-game-engine-special-proof": "npm run smoke:ide-game-engine-special-proof:j1",
    "smoke:ide-game-engine-special-proof:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-ide-game-engine-special-proof-j1.ps1",
    "package:davinci-resolve": "npm run package:davinci-resolve:j1",
    "package:davinci-resolve:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-davinci-resolve-j1.ps1",
    "smoke:davinci-resolve-developer-docs": "npm run smoke:davinci-resolve-developer-docs:j1",
    "smoke:davinci-resolve-developer-docs:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-davinci-resolve-developer-docs-j1.ps1",
    "package:visual-studio": "npm run package:visual-studio:j1",
    "package:visual-studio:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-visual-studio-j1.ps1",
    "package:unity-editor": "npm run package:unity-editor:j1",
    "package:unity-editor:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-unity-editor-j1.ps1",
    "package:unreal-engine": "npm run package:unreal-engine:j1",
    "package:unreal-engine:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-unreal-engine-j1.ps1",
    "package:affinity-content": "npm run package:affinity-content:j1",
    "package:affinity-content:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-affinity-content-j1.ps1",
    "smoke:affinity-manual-import": "npm run smoke:affinity-manual-import:j1",
    "smoke:affinity-manual-import:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-affinity-manual-import-j1.ps1",
    "smoke:affinity-loaded-app": "npm run smoke:affinity-loaded-app:j1",
    "smoke:affinity-loaded-app:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-affinity-loaded-app-j1.ps1",
    "smoke:affinity-photoshop-filter-plugin": "npm run smoke:affinity-photoshop-filter-plugin:j1",
    "smoke:affinity-photoshop-filter-plugin:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-affinity-photoshop-filter-plugin-j1.ps1",
    "smoke:office-sideloaded-host": "npm run smoke:office-sideloaded-host:j1",
    "smoke:office-sideloaded-host:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-office-sideloaded-host-j1.ps1",
    "smoke:local-service": "npm run smoke:local-service:j1",
    "smoke:local-service:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-local-service-j1.ps1",
    "build:blender": "npm run build:blender:j1",
    "build:blender:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-blender-j1.ps1",
    "build:canva": "npm run build:canva:j1",
    "build:canva:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-canva-j1.ps1",
    "smoke:canva-cloud-service": "npm run smoke:canva-cloud-service:j1",
    "smoke:canva-cloud-service:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-canva-cloud-service-j1.ps1",
    "build:figma": "npm run build:figma:j1",
    "build:figma:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-figma-j1.ps1",
    "build:obsidian": "npm run build:obsidian:j1",
    "build:obsidian:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-obsidian-j1.ps1",
    "build:zed": "npm run build:zed:j1",
    "build:zed:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-zed-j1.ps1",
    "build:sketch": "npm run build:sketch:j1",
    "build:sketch:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-sketch-j1.ps1",
    "build:adobe-uxp": "npm run build:adobe-uxp:j1",
    "build:adobe-uxp:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-adobe-uxp-j1.ps1",
    "package:adobe-ccx": "npm run package:adobe-ccx:j1",
    "package:adobe-ccx:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-adobe-ccx-j1.ps1",
    "smoke:adobe-uxp-plugin-id": "npm run smoke:adobe-uxp-plugin-id:j1",
    "smoke:adobe-uxp-plugin-id:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-adobe-uxp-plugin-id-j1.ps1",
    "smoke:creative-native-or-hybrid-plugin": "npm run smoke:creative-native-or-hybrid-plugin:j1",
    "smoke:creative-native-or-hybrid-plugin:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-creative-native-or-hybrid-plugin-j1.ps1",
    "build:office-taskpane": "npm run build:office-taskpane:j1",
    "build:office-taskpane:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-office-taskpane-j1.ps1",
    "build:google-workspace-apps-script": "npm run build:google-workspace-apps-script:j1",
    "build:google-workspace-apps-script:j1":
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-google-workspace-apps-script-j1.ps1"
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) {
      failures.push(`package.json script ${name} must route through the guarded j1 wrapper`);
    }
  }
}

function validateManifestTypesCurrent() {
  const generatorPath = join(root, "scripts/generate-manifest-types.ts");
  if (!existsSync(generatorPath)) {
    return;
  }

  try {
    execFileSync(process.execPath, ["--experimental-strip-types", "scripts/generate-manifest-types.ts", "--check"], {
      cwd: root,
      stdio: "pipe",
      windowsHide: true
    });
  } catch (error) {
    const message = error.stderr?.toString().trim() || error.message;
    failures.push(`generated manifest TypeScript types must be current: ${message}`);
  }
}

function validateBrowserManifestCapabilityParity() {
  const browserRoot = join(root, "hosts/browser/dx-browser");
  const dxManifest = readDxExtensionToml(join(browserRoot, "dx.extension.toml"));
  const capabilityIds = new Set(dxManifest.capabilities.map((capability) => capability.id));

  for (const [browserName, manifestPath] of [
    ["chromium", "manifests/manifest.chromium.json"],
    ["edge", "manifests/manifest.edge.json"],
    ["firefox", "manifests/manifest.firefox.json"]
  ]) {
    const manifest = JSON.parse(readFileSync(join(browserRoot, manifestPath), "utf8"));

    if (manifest.name !== dxManifest.extension.name) {
      failures.push(`${manifestPath} name must match dx.extension.toml`);
    }

    if (manifest.version !== dxManifest.extension.version) {
      failures.push(`${manifestPath} version must match dx.extension.toml`);
    }

    if ((manifest.host_permissions ?? []).length > 0) {
      failures.push(`${manifestPath} must not request host_permissions`);
    }

    for (const permission of manifest.permissions ?? []) {
      const capability = browserPermissionCapabilities[permission];
      if (capability && !capabilityIds.has(capability)) {
        failures.push(
          `${browserName} permission ${permission} requires DX capability ${capability}`
        );
      }
    }
  }
}

function readDxExtensionToml(path) {
  const manifest = {
    extension: {},
    capabilities: []
  };
  let section = "";
  let currentCapability = undefined;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed === "[extension]") {
      section = "extension";
      currentCapability = undefined;
      continue;
    }

    if (trimmed === "[[capabilities]]") {
      section = "capability";
      currentCapability = {};
      manifest.capabilities.push(currentCapability);
      continue;
    }

    if (trimmed.startsWith("[")) {
      section = "";
      currentCapability = undefined;
      continue;
    }

    const assignment = parseTomlAssignment(trimmed);
    if (!assignment) {
      continue;
    }

    if (section === "extension") {
      manifest.extension[assignment.key] = assignment.value;
    }

    if (section === "capability" && currentCapability) {
      currentCapability[assignment.key] = assignment.value;
    }
  }

  return manifest;
}

function parseTomlAssignment(line) {
  const match = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
  if (!match) {
    return undefined;
  }

  return {
    key: match[1],
    value: parseTomlScalar(match[2])
  };
}

function parseTomlScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function validateLockfile(workspaces) {
  const lockfilePath = join(root, "package-lock.json");
  if (!existsSync(lockfilePath)) {
    failures.push("package-lock.json is required for reproducible npm installs");
    return;
  }

  const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
  const lockedRoot = lockfile.packages?.[""];
  const lockedWorkspaces = lockedRoot?.workspaces ?? [];

  for (const workspace of workspaces) {
    if (!lockedWorkspaces.includes(workspace)) {
      failures.push(`package-lock.json must include workspace ${workspace}`);
    }

    if (!lockfile.packages?.[workspace]) {
      failures.push(`package-lock.json must include package ${workspace}`);
    }
  }
}

function validateBuildOutputContract() {
  for (const script of ["scripts/build-j1.ps1", "scripts/build-browser-j1.ps1"]) {
    const source = readFileSync(join(root, script), "utf8");
    const buildIndex = source.indexOf("build:artifacts");
    const proofIndex = source.indexOf("test:build-output");

    if (buildIndex === -1) {
      failures.push(`${script} must prepare browser build artifacts`);
    }

    if (proofIndex === -1) {
      failures.push(`${script} must verify browser build output`);
    }

    if (buildIndex !== -1 && proofIndex !== -1 && proofIndex < buildIndex) {
      failures.push(`${script} must verify browser build output after artifacts`);
    }
  }
}

function validateBrowserNativeHostSmokeContract() {
  const wrapperPath = "scripts/smoke-browser-native-host-j1.ps1";
  const wrapperSource = readFileSync(join(root, wrapperPath), "utf8");
  const testPath = "hosts/browser/dx-browser/tests/nativeHostBinarySmoke.test.ts";
  const testSource = readFileSync(join(root, testPath), "utf8");
  const runtimePath = "hosts/browser/dx-browser/tests/nativeHostProcessRuntime.ts";
  const runtimeSource = readFileSync(join(root, runtimePath), "utf8");
  const loadedCommandPath = "hosts/browser/dx-browser/tests/loadedBrowserCommandSmoke.test.ts";
  const loadedCommandSource = readFileSync(join(root, loadedCommandPath), "utf8");
  const loadedDispatchPath = "hosts/browser/dx-browser/tests/loadedBrowserDispatchSmoke.test.ts";
  const loadedDispatchSource = readFileSync(join(root, loadedDispatchPath), "utf8");

  requireSourceText(
    wrapperPath,
    wrapperSource,
    "command-policy.ps1",
    "must source the shared command policy"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "Set-DxSerialBuildEnvironment",
    "must set serial build environment variables"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    'Invoke-DxCommand "cargo" @("build", "-j", "1", "-p", "dx-browser-native-host", "--bin", "dx-browser-native-host")',
    "must build the native host with cargo -j 1"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "DX_BROWSER_NATIVE_HOST_BIN",
    "must pass the native-host path through DX_BROWSER_NATIVE_HOST_BIN"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "Remove-Item Env:\\DX_BROWSER_NATIVE_HOST_BIN",
    "must restore DX_BROWSER_NATIVE_HOST_BIN after the smoke test"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "DX_BROWSER_NATIVE_HOST_DX_BIN",
    "must pass the dx.exe path through DX_BROWSER_NATIVE_HOST_DX_BIN"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "Remove-Item Env:\\DX_BROWSER_NATIVE_HOST_DX_BIN",
    "must restore DX_BROWSER_NATIVE_HOST_DX_BIN after the smoke test"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "DX_BROWSER_NATIVE_HOST_WORKING_DIR",
    "must pass a hermetic dx working directory through DX_BROWSER_NATIVE_HOST_WORKING_DIR"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "Remove-Item Env:\\DX_BROWSER_NATIVE_HOST_WORKING_DIR",
    "must restore DX_BROWSER_NATIVE_HOST_WORKING_DIR after the smoke test"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "forge.package_manifest",
    "must create a minimal Forge package manifest for native-host command smoke"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "UTF8Encoding]::new($false)",
    "must write the Forge package manifest without a UTF-8 BOM"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "Remove-DxBrowserNativeHostForgeWorkspace",
    "must clean up the temporary Forge workspace after the smoke test"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    'GetFileName($DxBinaryPath) -ne "dx.exe"',
    "must reject non-dx.exe native-host CLI binaries"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    'Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:native-host-binary-smoke")',
    "must run the browser binary smoke through npm workspace scope"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    'Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:loaded-browser-dispatch-smoke")',
    "must run the loaded browser dispatch smoke through npm workspace scope"
  );
  requireSourceText(
    testPath,
    testSource,
    "sendNativeHostCommand",
    "must prove the browser JavaScript transport boundary"
  );
  requireSourceText(
    runtimePath,
    runtimeSource,
    "spawn(this.binaryPath",
    "must exercise the real native-host executable"
  );
  requireSourceText(
    runtimePath,
    runtimeSource,
    "shell: false",
    "must spawn the native host without a shell"
  );
  requireSourceText(
    testPath,
    testSource,
    "Unsupported DX browser native-host operation: workspace.delete",
    "must assert unsupported operations remain typed errors"
  );
  requireSourceText(
    loadedDispatchPath,
    loadedDispatchSource,
    "../dist/js/background/chromium.js",
    "must load the compiled Chromium background entrypoint"
  );
  requireSourceText(
    loadedDispatchPath,
    loadedDispatchSource,
    'createDxBrowserCommandMessage(resolveDxBrowserCommandPlan("status"))',
    "must dispatch the allowlisted status command through the runtime listener"
  );
  requireSourceText(
    loadedDispatchPath,
    loadedDispatchSource,
    "receiptPath",
    "must assert the native-host receipt path returned through the listener"
  );
  requireSourceText(
    loadedDispatchPath,
    loadedDispatchSource,
    "requires user approval",
    "must prove unapproved privileged commands do not reach the native host"
  );
  requireSourceText(
    loadedCommandPath,
    loadedCommandSource,
    "../dist/js/background/chromium.js",
    "must load the compiled Chromium background entrypoint"
  );
  requireSourceText(
    loadedCommandPath,
    loadedCommandSource,
    'invokeCommand("forgePackages")',
    "must dispatch the Forge Packages plan through the loaded background"
  );
  requireSourceText(
    loadedCommandPath,
    loadedCommandSource,
    'invokeCommand("showBuildGraph")',
    "must dispatch the Build Graph plan through the loaded background"
  );
  requireSourceText(
    loadedCommandPath,
    loadedCommandSource,
    'invokeCommand("doctor", true)',
    "must dispatch approved privileged commands through the loaded background"
  );
  requireSourceText(
    loadedCommandPath,
    loadedCommandSource,
    'invokeCommand("openReceipts")',
    "must dispatch host UI receipt actions through the loaded background"
  );
  requireSourceText(
    loadedCommandPath,
    loadedCommandSource,
    "DX browser command sender is not trusted.",
    "must prove untrusted senders do not reach the native host"
  );
}

function validateBrowserNativeHostInstallProofContract() {
  const wrapperPath = "scripts/install-browser-native-host-j1.ps1";
  const wrapperSource = readFileSync(join(root, wrapperPath), "utf8");
  const installPath = "hosts/browser/dx-browser/scripts/install-native-host.ps1";
  const installSource = readFileSync(join(root, installPath), "utf8");
  const testPath = "hosts/browser/dx-browser/tests/nativeHostInstallProof.test.ts";
  const testSource = readFileSync(join(root, testPath), "utf8");
  const shellTestPath = "hosts/browser/dx-browser/tests/nativeHostShellInstallProof.test.ts";
  const shellTestSource = readFileSync(join(root, shellTestPath), "utf8");
  const shellUninstallTestPath = "hosts/browser/dx-browser/tests/nativeHostShellUninstallProof.test.ts";
  const shellUninstallTestSource = readFileSync(join(root, shellUninstallTestPath), "utf8");
  const shellUninstallPath = "hosts/browser/dx-browser/scripts/uninstall-native-host.sh";
  const shellUninstallSource = readFileSync(join(root, shellUninstallPath), "utf8");

  requireSourceText(
    wrapperPath,
    wrapperSource,
    "ManifestOnly",
    "must expose manifest-only install proof mode"
  );
  requireSourceText(
    wrapperPath,
    wrapperSource,
    "FirefoxManifestRoot",
    "must route Firefox manifest output into a configurable root"
  );
  requireSourceText(
    installPath,
    installSource,
    "[switch] $ManifestOnly",
    "must support manifest-only install proof mode"
  );
  requireSourceText(
    installPath,
    installSource,
    "if ($ManifestOnly)",
    "must skip registry writes during manifest-only proof"
  );
  requireSourceText(
    installPath,
    installSource,
    "$FirefoxManifestRoot",
    "must support configurable Firefox manifest output"
  );
  requireSourceText(
    installPath,
    installSource,
    "$EdgeExtensionId",
    "must require an explicit Edge extension id for Edge native-host manifests"
  );
  requireSourceText(
    installPath,
    installSource,
    "HKCU:\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\dev.dx.browser",
    "must register Edge native-host manifests through the Microsoft Edge user-scoped registry path"
  );
  requireSourceText(
    "hosts/browser/dx-browser/scripts/install-native-host.sh",
    readFileSync(join(root, "hosts/browser/dx-browser/scripts/install-native-host.sh"), "utf8"),
    "--manifest-only",
    "must expose shell manifest-only install proof mode"
  );
  requireSourceText(
    shellUninstallPath,
    shellUninstallSource,
    "--manifest-only",
    "must expose shell manifest-only uninstall proof mode"
  );
  requireSourceText(
    testPath,
    testSource,
    "-ManifestOnly",
    "must exercise manifest-only install proof"
  );
  requireSourceText(
    testPath,
    testSource,
    "-FirefoxManifestRoot",
    "must prove Firefox manifests without touching user profile paths"
  );
  requireSourceText(
    testPath,
    testSource,
    "-EdgeExtensionId",
    "must exercise a separate Edge extension id"
  );
  requireSourceText(
    testPath,
    testSource,
    'join(installRoot, "edge", "dev.dx.browser.json")',
    "must assert the manifest-only Edge native-host output"
  );
  requireSourceText(
    testPath,
    testSource,
    "chrome-extension://${edgeExtensionId}/",
    "must assert the Edge extension id is used in allowed_origins"
  );
  requireSourceText(
    shellTestPath,
    shellTestSource,
    "--manifest-only",
    "must exercise shell manifest-only install proof"
  );
  requireSourceText(
    shellTestPath,
    shellTestSource,
    "--edge-extension-id",
    "must exercise a separate shell Edge extension id"
  );
  requireSourceText(
    shellTestPath,
    shellTestSource,
    'join(installRoot, "chrome", "dev.dx.browser.json")',
    "must assert the shell manifest-only Chrome native-host output"
  );
  requireSourceText(
    shellTestPath,
    shellTestSource,
    'join(installRoot, "edge", "dev.dx.browser.json")',
    "must assert the shell manifest-only Edge native-host output"
  );
  requireSourceText(
    shellTestPath,
    shellTestSource,
    'join(firefoxManifestRoot, "dev.dx.browser.json")',
    "must assert the shell manifest-only Firefox native-host output"
  );
  requireSourceText(
    shellUninstallTestPath,
    shellUninstallTestSource,
    "--manifest-only",
    "must exercise shell manifest-only uninstall proof"
  );
  requireSourceText(
    shellUninstallTestPath,
    shellUninstallTestSource,
    'join(installRoot, "edge", "dev.dx.browser.json")',
    "must assert the shell manifest-only Edge native-host removal"
  );
}

function requireSourceText(relativePath, source, text, message) {
  if (!source.includes(text)) {
    failures.push(`${relativePath} ${message}`);
  }
}

function validateScriptSource(relativePath) {
  if (relativePath === "scripts/verify-workspace.ts") {
    return;
  }

  const source = readFileSync(join(root, relativePath), "utf8");
  const forbiddenPatterns = [
    [/\bStart-Job\b/i, "must not start background jobs"],
    [/\bStart-ThreadJob\b/i, "must not start thread jobs"],
    [/ForEach-Object\s+-Parallel/i, "must not use parallel PowerShell loops"],
    [/\bStart-Process\b/i, "must not launch detached processes"],
    [/\bCompress-Archive\b/i, "must not package artifacts outside a reviewed package wrapper"],
    [/\bPromise\.all\s*\(/, "must not fan out asynchronous build/package work"],
    [/(?:shell\s*:\s*true|shell\s*=\s*\$true)/i, "must not spawn shell commands"]
  ];

  for (const [pattern, message] of forbiddenPatterns) {
    if (pattern.test(source)) {
      failures.push(`${relativePath} ${message}`);
    }
  }

  if (relativePath.endsWith(".ps1")) {
    validatePowerShellDirectHeavyCommands(relativePath, source);
    validatePowerShellCargoInvocations(relativePath, source);
    validatePowerShellNpmFanOutInvocations(relativePath, source);
  }

  if (relativePath === "scripts/command-policy.ps1") {
    validateCommandPolicyRuntimeGuard(relativePath, source);
  }
}

function validateCommandPolicyRuntimeGuard(relativePath, source) {
  requireSourceText(
    relativePath,
    source,
    "function Assert-DxCommandPolicy",
    "must define the runtime command policy guard"
  );
  requireSourceText(
    relativePath,
    source,
    "Assert-DxCommandPolicy -FilePath $FilePath -Arguments $Arguments",
    "must enforce policy before Invoke-DxCommand executes"
  );
  requireSourceText(
    relativePath,
    source,
    "Cargo heavy commands must include -j 1",
    "must reject unguarded Cargo heavy commands at runtime"
  );
  requireSourceText(
    relativePath,
    source,
    "npm workspace fan-out is not allowed for heavy commands",
    "must reject npm workspace fan-out at runtime"
  );
}

function validatePowerShellDirectHeavyCommands(relativePath, source) {
  const directHeavyCargo = /(?:^|[\s;&|])(?:&\s*)?(?:cargo|cargo\.exe)\s+(?:build|check|test|clippy)\b/im;

  if (directHeavyCargo.test(source)) {
    failures.push(`${relativePath} must route Cargo heavy commands through Invoke-DxCommand with -j 1`);
  }
}

function validatePowerShellCargoInvocations(relativePath, source) {
  const cargoInvocations = source.matchAll(/Invoke-DxCommand\s+"cargo"\s+@\((?<args>[^)]*)\)/gms);

  for (const invocation of cargoInvocations) {
    const args = invocation.groups?.args ?? "";
    const runsHeavyCargoCommand = /"(?:build|check|test|clippy)"/.test(args);

    if (runsHeavyCargoCommand && !/"-j"\s*,\s*"1"/.test(args)) {
      failures.push(`${relativePath} cargo wrapper invocations must include -j 1`);
    }
  }
}

function validatePowerShellNpmFanOutInvocations(relativePath, source) {
  const npmInvocations = source.matchAll(/Invoke-DxCommand\s+"npm"\s+@\((?<args>[^)]*)\)/gms);

  for (const invocation of npmInvocations) {
    const args = invocation.groups?.args ?? "";
    const runsWorkspaceFanOut = /"--workspaces"/.test(args) && /"run"/.test(args);
    const runsHeavyScript = /"(?:build|check|test|package)"/.test(args);

    if (runsWorkspaceFanOut && runsHeavyScript) {
      failures.push(`${relativePath} npm wrapper invocations must not fan out heavy commands across all workspaces`);
    }
  }
}

function findPackageJsonFiles(directory, prefix = "") {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target") {
      continue;
    }

    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findPackageJsonFiles(absolutePath, relativePath));
    } else if (entry.isFile() && entry.name === "package.json") {
      files.push(relativePath);
    }
  }

  return files;
}

function findScriptFiles(directory, prefix = "") {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target" || entry.name === "dist") {
      continue;
    }

    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findScriptFiles(absolutePath, relativePath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ps1") ||
        (relativePath.startsWith("scripts/") && entry.name.endsWith(".ts")) ||
        (relativePath.includes("/scripts/") && entry.name.endsWith(".ts")) ||
        entry.name.endsWith(".test.ts"))
    ) {
      files.push(relativePath);
    }
  }

  return files;
}
