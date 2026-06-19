param(
    [string[]] $AdapterId = @()
)

. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $proofPath = Join-Path (Resolve-Path ".").Path ".tmp\proofs\package-output-release-package-checksums.json"
    $buildArguments = @(
        "--experimental-strip-types",
        "scripts/build-package-output-release-packages.ts",
        "--proof-json",
        $proofPath
    )

    foreach ($targetAdapterId in $AdapterId) {
        if (-not [string]::IsNullOrWhiteSpace($targetAdapterId)) {
            $buildArguments += @("--adapter-id", $targetAdapterId)
        }
    }

    Invoke-DxCommand "npm" @("run", "test:package-output-release-package-checksum")
    Invoke-DxCommand "node" $buildArguments

    $env:DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON = $proofPath
    $env:DX_VERIFICATION_COMMAND = "npm run package:package-output-release-checksum:j1"
    Invoke-DxCommand "npm" @("run", "smoke:release-package-checksum:j1")
}
finally {
    Remove-Item Env:\DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON -ErrorAction SilentlyContinue
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
