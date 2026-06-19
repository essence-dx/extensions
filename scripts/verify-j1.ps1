. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "powershell" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/verify-light.ps1")
    Invoke-DxInternalWorkspaceScript -Workspace "dx-vscode" -ScriptName "internal:check"
    Invoke-DxInternalWorkspaceScript -Workspace "dx-browser" -ScriptName "internal:check"
    Invoke-DxCommand "cargo" @("fmt", "--all", "--", "--check")
    Invoke-DxCommand "cargo" @("test", "-j", "1", "--workspace")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-source-readiness-receipts.ts", "--verification-command", "npm run verify:j1")
}
finally {
    Pop-Location
}
