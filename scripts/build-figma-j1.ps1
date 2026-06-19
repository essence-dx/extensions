. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:figma-adapter")
    Invoke-DxCommand "npm" @("run", "test:figma-build-output")
    Invoke-DxCommand "npm" @("run", "test:figma-canva-package-output-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-figma-plugin.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-figma-canva-package-output-receipts.ts", "--host", "figma")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.figma.command-center", "--verification-command", "npm run build:figma:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
