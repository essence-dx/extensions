. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    if (Test-Path "package-lock.json") {
        Invoke-DxCommand "npm" @(
            "ci",
            "--workspaces",
            "--include-workspace-root",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--progress=false"
        )
    }
    else {
        Invoke-DxCommand "npm" @(
            "install",
            "--workspaces",
            "--include-workspace-root",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--progress=false"
        )
    }
}
finally {
    Pop-Location
}
