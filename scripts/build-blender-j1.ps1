. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:blender-adapter")
    Invoke-DxCommand "npm" @("run", "test:blender-package-output")
    Invoke-DxCommand "npm" @("run", "test:blender-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-blender-package-output.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-blender-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.blender.command-center", "--verification-command", "npm run build:blender:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
