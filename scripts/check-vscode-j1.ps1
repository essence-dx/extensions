. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxInternalWorkspaceScript -Workspace "dx-vscode" -ScriptName "internal:check"
}
finally {
    Pop-Location
}
