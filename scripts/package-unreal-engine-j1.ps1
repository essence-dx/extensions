. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:unreal-engine-plugin-adapter")
    Invoke-DxCommand "npm" @("run", "test:unreal-engine-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-unreal-engine-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.unreal-engine.command-center", "--verification-command", "npm run package:unreal-engine:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
