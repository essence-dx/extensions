. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_OFFICE_SIDELOADED_HOST_PROOF_JSON)) {
    throw "DX_OFFICE_SIDELOADED_HOST_PROOF_JSON must point to a metadata-only Office sideload proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:office-sideloaded-host-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-office-sideloaded-host-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
