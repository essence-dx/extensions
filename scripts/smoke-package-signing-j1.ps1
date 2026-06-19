. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_PACKAGE_SIGNING_PROOF_JSON)) {
    throw "DX_PACKAGE_SIGNING_PROOF_JSON must point to a package signing proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:package-signing:j1"
    Invoke-DxCommand "npm" @("run", "test:package-signing-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-package-signing-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
