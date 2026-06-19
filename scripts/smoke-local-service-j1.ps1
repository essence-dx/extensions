. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_LOCAL_SERVICE_PROOF_JSON)) {
    throw "DX_LOCAL_SERVICE_PROOF_JSON must point to a local-service proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:local-service:j1"
    Invoke-DxCommand "npm" @("run", "test:local-service-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-local-service-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
