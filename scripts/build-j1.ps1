. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 4
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "cargo" @("build", "-j", "1", "--workspace")
    Invoke-DxCommand "npm" @("--workspace", "dx-vscode", "run", "compile")
    Invoke-DxInternalWorkspaceScript -Workspace "dx-browser" -ScriptName "internal:check"
    Invoke-DxInternalWorkspaceScript -Workspace "dx-browser" -ScriptName "internal:build:artifacts"
    Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:build-output")
}
finally {
    Pop-Location
}
