. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_CREATIVE_NATIVE_OR_HYBRID_PLUGIN_PROOF_JSON)) {
    throw "DX_CREATIVE_NATIVE_OR_HYBRID_PLUGIN_PROOF_JSON must point to a creative native/hybrid proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:creative-native-or-hybrid-plugin:j1"
    Invoke-DxCommand "npm" @("run", "test:creative-native-or-hybrid-plugin-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-creative-native-or-hybrid-plugin-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
