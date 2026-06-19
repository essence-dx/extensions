. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $proofPath = Join-Path (Resolve-Path ".").Path ".tmp\proofs\affinity-release-package-checksum.json"

    Invoke-DxCommand "npm" @("run", "test:affinity-release-package-checksum")
    Invoke-DxCommand "node" @(
        "--experimental-strip-types",
        "scripts/build-affinity-release-package.ts",
        "--proof-json",
        $proofPath
    )

    $env:DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON = $proofPath
    $env:DX_VERIFICATION_COMMAND = "npm run package:affinity-release-checksum:j1"
    Invoke-DxCommand "npm" @("run", "smoke:release-package-checksum:j1")
}
finally {
    Remove-Item Env:\DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON -ErrorAction SilentlyContinue
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
