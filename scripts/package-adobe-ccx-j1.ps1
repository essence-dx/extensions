. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $previousVerificationCommand = $env:DX_VERIFICATION_COMMAND
    $previousProofJson = $env:DX_ADOBE_CCX_PACKAGE_PROOF_JSON
    $previousChecksumProofJson = $env:DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON
    $generatedProofPath = Join-Path (Resolve-Path ".").Path ".tmp\proofs\adobe-ccx-package-proofs.json"
    $generatedChecksumProofPath = Join-Path (Resolve-Path ".").Path ".tmp\proofs\adobe-ccx-release-checksums.json"
    $env:DX_VERIFICATION_COMMAND = "npm run package:adobe-ccx:j1"

    try {
        Invoke-DxCommand "npm" @("run", "test:adobe-ccx-package-builder")
        if ([string]::IsNullOrWhiteSpace($env:DX_ADOBE_CCX_PACKAGE_PROOF_JSON)) {
            Invoke-DxCommand "node" @(
                "--experimental-strip-types",
                "scripts/build-adobe-ccx-package-proofs.ts",
                "--proof-json",
                $generatedProofPath
            )
            $env:DX_ADOBE_CCX_PACKAGE_PROOF_JSON = $generatedProofPath
        }
        Invoke-DxCommand "npm" @("run", "test:adobe-ccx-package-receipts")
        Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-adobe-ccx-package-receipts.ts")
        Invoke-DxCommand "npm" @("run", "test:adobe-ccx-release-checksum-builder")
        Invoke-DxCommand "node" @(
            "--experimental-strip-types",
            "scripts/build-adobe-ccx-release-checksum-proofs.ts",
            "--proof-json",
            $generatedChecksumProofPath
        )
        $env:DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON = $generatedChecksumProofPath
        Invoke-DxCommand "npm" @("run", "smoke:release-package-checksum:j1")
        Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
    }
    finally {
        if ($null -eq $previousVerificationCommand) {
            Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_VERIFICATION_COMMAND = $previousVerificationCommand
        }

        if ($null -eq $previousProofJson) {
            Remove-Item Env:\DX_ADOBE_CCX_PACKAGE_PROOF_JSON -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_ADOBE_CCX_PACKAGE_PROOF_JSON = $previousProofJson
        }

        if ($null -eq $previousChecksumProofJson) {
            Remove-Item Env:\DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON = $previousChecksumProofJson
        }
    }
}
finally {
    Pop-Location
}
