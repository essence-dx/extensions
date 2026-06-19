. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxInternalWorkspaceScript -Workspace "dx-vscode" -ScriptName "internal:check"
    Invoke-DxCommand "npm" @("--workspace", "dx-vscode", "run", "compile")

    Push-Location "hosts\vscode\dx-vscode"
    try {
        $previousPackageGuard = $env:DX_VSCODE_PACKAGE_J1
        $env:DX_VSCODE_PACKAGE_J1 = "1"
        try {
            Invoke-DxCommand "npx" @("--no-install", "vsce", "package", "--no-dependencies")
        }
        finally {
            if ($null -eq $previousPackageGuard) {
                Remove-Item Env:\DX_VSCODE_PACKAGE_J1 -ErrorAction SilentlyContinue
            }
            else {
                $env:DX_VSCODE_PACKAGE_J1 = $previousPackageGuard
            }
        }
    }
    finally {
        Pop-Location
    }

    Invoke-DxCommand "npm" @("run", "test:vscode-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-vscode-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.vscode.command-center", "--verification-command", "npm run package:vscode:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
