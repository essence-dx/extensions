# Professional Host Targets

This catalog is a planning index for future official DX host adapters. It is
not release readiness, not the official extension registry, and not a claim that
any package exists, is installable, has marketplace approval, has signing proof,
or has loaded-host smoke proof.

Every target must pass the Official Extension Starter gate before source folders
are added under `hosts/`. The catalog can rank interest and difficulty, but
release readiness remains gated by official SDK evidence, permissions, signing,
checksum receipts, loaded-host smoke receipts, and DX CLI or local-service proof.

## Next Proof Order

1. Finish loaded-host proof for `hosts/vscode/dx-vscode` and
   `hosts/browser/dx-browser`, including VS Code/Cursor/Windsurf smoke receipts
   and Chrome, Microsoft Edge, and Firefox loaded-browser dispatch receipts.
2. Treat Microsoft Edge as separate distribution proof: explicit Edge extension
   id, Edge native-host manifest receipt, loaded Edge dispatch receipt, Edge
   Add-ons package/review evidence, signing, checksums, and release packaging.
3. After browser/editor proof is recorded, take one loaded-host smoke slice at a
   time for existing source scaffolds: Zed, Blender, Obsidian, Figma, Canva,
   Sketch, Adobe UXP, DaVinci Resolve, Office, Google Workspace, IntelliJ
   Platform, Visual Studio, Unity Editor, and Unreal Engine.
4. Do not create additional `hosts/` folders until the new target has a starter
   record and the active source scaffolds still state what remains unproven.

## Target Groups

| Group | Targets | Reason |
| --- | --- | --- |
| Active source scaffold | VS Code, Chrome, Microsoft Edge, Firefox, Zed, Blender, Obsidian, Figma, Canva, Sketch, Photoshop, Premiere Pro, InDesign, DaVinci Resolve, Excel, PowerPoint, Word, Google Workspace, IntelliJ Platform, Visual Studio, Unity Editor, Unreal Engine | DX already has source under `hosts/`; proof work should focus on loaded-host, package, host-specific, service, signing, checksum, and review receipts. |
| Fast proof | Existing source scaffolds with local development modes | Adapter shapes are now source-level; the next value comes from loaded-host smoke receipts, not additional source folders. |
| Starter candidate | None currently open | Create a new starter record only when a new target is more valuable than proving the active source scaffolds. |
| Research | Teams, Slack, Rhino, Fusion | Useful host surfaces, but distribution, auth, sandbox, or SDK details need deeper proof before source folders are created. |
| Hard native SDK | Revit, AutoCAD, Acrobat | Strong professional leverage, but signing, native SDK setup, and loaded-host verification are heavier. |

## Required Evidence Per Target

Each catalog entry in `registry/professional-host-targets.toml` must keep:

- Official documentation URL.
- Exact host extension surface.
- Thin-adapter strategy back to DX CLI or a DX local service.
- First proof that can produce metadata-only receipts.
- Difficulty score from 1 to 100.
- DX surfaces, such as icons, fonts, media, forge, commands, assets, receipts,
  or local service.
- Release gates covering official docs, permission review, guarded `j1`
  verification, package signing and checksums, and loaded-host smoke receipts.

## Priority Host Targets

| Priority | Host | Difficulty | First DX proof |
| --- | --- | ---: | --- |
| 1 | VS Code | 25 | Run the source-level VS Code Extension Development Host smoke runner and capture metadata-only command registration receipt. |
| 2 | Chrome | 35 | Load unpacked extension with development native-host manifest. |
| 3 | Microsoft Edge | 40 | Load unpacked Edge build with an explicit Edge extension id, register the Edge native-host manifest, and capture Edge-specific loaded-browser dispatch receipts. |
| 4 | Firefox | 42 | Prove Firefox WebExtension and native-host install path. |
| 5 | Obsidian | 40 | Load a test-vault plugin with workspace trust gates. |
| 6 | Figma | 50 | Run a development plugin for DX asset search and receipt capture. |
| 7 | Zed | 55 | Install a local Zed dev extension and capture metadata-only command availability. |
| 8 | Blender | 55 | Install a Python add-on and prove metadata-only operators. |
| 9 | Sketch | 58 | Run a local document command for DX asset insertion. |
| 10 | Canva | 62 | Run a development app and prove asset insertion metadata. |
| 11 | Excel | 65 | Sideload an Office task pane with workbook-safe receipts. |
| 12 | PowerPoint | 66 | Sideload an Office add-in for media and icon insertion. |
| 13 | Word | 66 | Sideload a Word Office task pane with document-safe metadata-only receipts. |
| 14 | Google Workspace | 70 | Capture Apps Script deployment, cloud-service, and Workspace file smoke receipts from the active add-on scaffold. |
| 15 | IntelliJ Platform | 70 | Capture sandbox IDE loaded-host proof, then Plugin Verifier metadata-only proof input through the guarded receipt writer. |
| 16 | Visual Studio | 74 | Capture Experimental Instance loaded-host proof for the active VSIX scaffold. |
| 17 | Unity Editor | 68 | Load a local editor package in a test project, then capture project-import proof. |
| 18 | Unreal Engine | 76 | Load an editor plugin in a sample project, then capture project-enablement proof. |
| 19 | Slack | 65 | Install a test-workspace app with least-privilege scopes. |
| 20 | Teams | 72 | Sideload a Teams app package with service-side receipts. |
| 21 | Rhino | 70 | Load a RhinoCommon command plugin in a sample model. |
| 22 | Photoshop | 78 | Load the development UXP plugin through UXP Developer Tool and capture metadata-only panel and command availability receipts. |
| 23 | DaVinci Resolve | 86 | Load a development scripting command center in Resolve and capture metadata-only command availability plus read-only project-inspection receipts. |
| 24 | Premiere Pro | 86 | Load the development UXP plugin in Premiere Pro and capture metadata-only panel, command, and project-safe receipt metadata. |
| 25 | InDesign | 80 | Load the development UXP plugin in InDesign and capture metadata-only panel, command, and document-safe receipt metadata. |

## Deferred Proof Targets

Acrobat, Revit, AutoCAD, Fusion, Slack, Teams, and Rhino should stay research
targets until the repo has written proof for SDK setup, signing, host
installation, and loaded-host smoke receipts. They are valuable, but they
should not be first folders unless a specific customer workflow needs one
immediately.
