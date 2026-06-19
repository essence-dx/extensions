. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("--workspace", "dx-vscode", "run", "compile")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/smoke-vscode-loaded-host-j1.ts")
}
finally {
    Pop-Location
}
