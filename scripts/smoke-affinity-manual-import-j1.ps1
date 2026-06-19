. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_AFFINITY_MANUAL_IMPORT_PROOF_JSON)) {
    throw "DX_AFFINITY_MANUAL_IMPORT_PROOF_JSON must point to a metadata-only manual import proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:affinity-manual-import-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-affinity-manual-import-receipt.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
