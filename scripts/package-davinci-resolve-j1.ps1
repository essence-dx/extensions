. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:davinci-resolve-adapter")
    Invoke-DxCommand "npm" @("run", "test:davinci-resolve-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-davinci-resolve-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.davinci-resolve.command-center", "--verification-command", "npm run package:davinci-resolve:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
