. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run write:package-output-checksum-receipts:j1"
    Invoke-DxCommand "npm" @("run", "test:package-output-checksum-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-package-output-checksum-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
