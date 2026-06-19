. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 4
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $planPath = Join-Path (Resolve-Path ".").Path ".tmp\proofs\host-free-release-artifacts.json"

    Invoke-DxCommand "npm" @("run", "test:host-free-release-artifact-refresh-plan")
    Invoke-DxCommand "npm" @("run", "report:release-evidence-gaps:j1")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/refresh-host-free-release-artifacts.ts", "--commands-json", $planPath)

    $plan = Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
    foreach ($plannedCommand in @($plan.commands)) {
        $arguments = @($plannedCommand.arguments | ForEach-Object { [string] $_ })
        Invoke-DxCommand $plannedCommand.executable $arguments
    }

    Invoke-DxCommand "npm" @("run", "report:release-evidence-gaps:j1")
    Invoke-DxCommand "npm" @("run", "report:extension-progress:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
