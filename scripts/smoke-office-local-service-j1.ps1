. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_OFFICE_LOCAL_SERVICE_PROOF_JSON)) {
    throw "DX_OFFICE_LOCAL_SERVICE_PROOF_JSON must point to a metadata-only Office local-service proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:office-local-service:j1"
    Invoke-DxCommand "npm" @("run", "test:office-local-service-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-office-local-service-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
