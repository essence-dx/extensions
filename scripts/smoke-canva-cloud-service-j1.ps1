. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_CANVA_CLOUD_SERVICE_PROOF_JSON)) {
    throw "DX_CANVA_CLOUD_SERVICE_PROOF_JSON must point to a Canva cloud-service proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:canva-cloud-service:j1"
    Invoke-DxCommand "npm" @("run", "test:canva-cloud-service-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-canva-cloud-service-receipt.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
