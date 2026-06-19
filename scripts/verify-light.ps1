. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "git" @("diff", "--check")

    & rg -n "<<<<<<<|>>>>>>>" . --glob "!scripts/verify-light.ps1"
    if ($LASTEXITCODE -gt 1) {
        throw "Conflict-marker scan failed with exit code ${LASTEXITCODE}."
    }

    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/verify-workspace.ts")
    Invoke-DxCommand "npm" @("run", "check:typescript-source-extensions")
    Invoke-DxCommand "npm" @("run", "test:vscode-package-verifier")
    Invoke-DxCommand "npm" @("run", "test:vscode-loaded-host-proof-receipts")
    Invoke-DxCommand "npm" @("run", "test:vscode-loaded-host-smoke")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/verify-vscode-package.ts", "hosts/vscode/dx-vscode/package.json")
}
finally {
    Pop-Location
}
