. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $previousVerificationCommand = $env:DX_VERIFICATION_COMMAND
    $env:DX_VERIFICATION_COMMAND = "npm run write:browser-host-action-index-receipt:j1"

    Invoke-DxCommand "npm" @("run", "test:browser-host-action-index-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-browser-host-action-index-receipt.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    if ($null -eq $previousVerificationCommand) {
        Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    }
    else {
        $env:DX_VERIFICATION_COMMAND = $previousVerificationCommand
    }

    Pop-Location
}
