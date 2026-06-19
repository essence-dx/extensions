. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:zed-adapter")
    Invoke-DxCommand "npm" @("run", "test:zed-build-output")
    Invoke-DxCommand "npm" @("run", "test:zed-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-zed-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.zed.command-center", "--verification-command", "npm run package:zed:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
