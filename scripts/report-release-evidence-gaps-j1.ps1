. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run report:release-evidence-gaps:j1"
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-affinity-content-package")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-browser-blockers")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-browser-distribution-targets")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-adobe-plugin-id-gate")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-checksum-artifact")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-core-evidence")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-visual-studio-package-output")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-ide-game-engine")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-ide-game-engine-package-output")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-ide-game-engine-loaded-host")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-ide-game-engine-environment")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-creative-loaded-host")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-special-evidence")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-office-local-service")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-remediation")
    Invoke-DxCommand "npm" @("run", "test:release-evidence-gap-report-signing-review-freshness")
    Invoke-DxCommand "npm" @("run", "check:release-evidence-gates")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-release-evidence-gap-report.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
