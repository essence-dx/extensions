. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:affinity-content-package-output")
    Invoke-DxCommand "npm" @("run", "test:affinity-content-package-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-affinity-content-package.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-affinity-content-package-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.affinity-content.bridge", "--verification-command", "npm run package:affinity-content:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
