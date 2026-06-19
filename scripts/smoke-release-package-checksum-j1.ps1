. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON)) {
    throw "DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON must point to a release package checksum proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    if ([string]::IsNullOrWhiteSpace($env:DX_VERIFICATION_COMMAND)) {
        $env:DX_VERIFICATION_COMMAND = "npm run smoke:release-package-checksum:j1"
    }

    Invoke-DxCommand "npm" @("run", "test:release-package-checksum-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-release-package-checksum-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
