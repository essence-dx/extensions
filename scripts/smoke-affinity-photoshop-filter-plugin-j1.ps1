. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_AFFINITY_PHOTOSHOP_FILTER_PLUGIN_PROOF_JSON)) {
    throw "DX_AFFINITY_PHOTOSHOP_FILTER_PLUGIN_PROOF_JSON must point to a metadata-only Affinity Photoshop-compatible filter plugin proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:affinity-photoshop-filter-plugin-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-affinity-photoshop-filter-plugin-receipt.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
