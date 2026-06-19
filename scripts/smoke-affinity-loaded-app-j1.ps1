. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_AFFINITY_LOADED_APP_PROOF_JSON)) {
    throw "DX_AFFINITY_LOADED_APP_PROOF_JSON must point to a metadata-only loaded Affinity app proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:affinity-loaded-app-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-affinity-loaded-app-receipt.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
