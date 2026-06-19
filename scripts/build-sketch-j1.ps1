. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:sketch-adapter")
    Invoke-DxCommand "npm" @("run", "test:sketch-build-output")
    Invoke-DxCommand "npm" @("run", "test:sketch-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-sketch-plugin.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-sketch-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.sketch.command-center", "--verification-command", "npm run build:sketch:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
