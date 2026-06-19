. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_APPLICATION_LOADED_HOST_PROOF_JSON)) {
    throw "DX_APPLICATION_LOADED_HOST_PROOF_JSON must point to an application loaded-host proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:application-loaded-host:j1"
    Invoke-DxCommand "npm" @("run", "test:application-loaded-host-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-application-loaded-host-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
