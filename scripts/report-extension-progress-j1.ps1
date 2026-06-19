. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run report:extension-progress:j1"
    Invoke-DxCommand "npm" @("run", "test:extension-progress-report")
    Invoke-DxCommand "npm" @("run", "test:extension-progress-report-affinity-content")
    Invoke-DxCommand "npm" @("run", "test:extension-progress-stale-readiness")
    Invoke-DxCommand "npm" @("run", "check:release-evidence-gates")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-extension-progress-report.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
