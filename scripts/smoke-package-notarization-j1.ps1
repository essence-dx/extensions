. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_PACKAGE_NOTARIZATION_PROOF_JSON)) {
    throw "DX_PACKAGE_NOTARIZATION_PROOF_JSON must point to a package notarization proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:package-notarization:j1"
    Invoke-DxCommand "npm" @("run", "test:package-notarization-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-package-notarization-receipt.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
