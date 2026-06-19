. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_DISTRIBUTION_REVIEW_PROOF_JSON)) {
    throw "DX_DISTRIBUTION_REVIEW_PROOF_JSON must point to a distribution review proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:distribution-review:j1"
    Invoke-DxCommand "npm" @("run", "test:distribution-review-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-distribution-review-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
