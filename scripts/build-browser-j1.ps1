. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxInternalWorkspaceScript -Workspace "dx-browser" -ScriptName "internal:check"
    Invoke-DxInternalWorkspaceScript -Workspace "dx-browser" -ScriptName "internal:build:artifacts"
    Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:build-output")
    Invoke-DxCommand "npm" @("run", "test:browser-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-browser-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.browser.command-center", "--verification-command", "npm run build:browser:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
