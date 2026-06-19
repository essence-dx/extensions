. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_ADOBE_UXP_PLUGIN_ID_PROOF_JSON)) {
    throw "DX_ADOBE_UXP_PLUGIN_ID_PROOF_JSON must point to an Adobe UXP plugin-id proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $previousVerificationCommand = $env:DX_VERIFICATION_COMMAND
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:adobe-uxp-plugin-id:j1"

    try {
        Invoke-DxCommand "npm" @("run", "test:adobe-uxp-plugin-id-receipt")
        Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-adobe-uxp-plugin-id-receipt.ts")
        Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
    }
    finally {
        if ($null -eq $previousVerificationCommand) {
            Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_VERIFICATION_COMMAND = $previousVerificationCommand
        }
    }
}
finally {
    Pop-Location
}
