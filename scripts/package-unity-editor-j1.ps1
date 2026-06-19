. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:unity-editor-plugin-adapter")
    Invoke-DxCommand "npm" @("run", "test:unity-editor-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-unity-editor-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.unity-editor.command-center", "--verification-command", "npm run package:unity-editor:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
