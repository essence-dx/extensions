. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:browser-extension-id-capture")
    Invoke-DxCommand "node" (@("--experimental-strip-types", "scripts/capture-browser-extension-ids.ts") + $args)
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
