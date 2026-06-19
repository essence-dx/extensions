. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:davinci-resolve-developer-docs:j1"
    Invoke-DxCommand "npm" @("run", "test:davinci-resolve-developer-docs-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-davinci-resolve-developer-docs-receipt.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
