. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:zed-adapter")
    Invoke-DxCommand "npm" @("run", "test:zed-build-output")

    $adapterRoot = Resolve-Path "hosts\zed\dx-zed"
    $targetRoot = Join-Path $adapterRoot.Path "target"
    $compiledWasmPath = Join-Path $targetRoot "wasm32-unknown-unknown\debug\dx_command_center.wasm"

    Invoke-DxCommand "cargo" @(
        "build",
        "-j",
        "1",
        "--manifest-path",
        "hosts/zed/dx-zed/Cargo.toml",
        "--target",
        "wasm32-unknown-unknown",
        "--target-dir",
        $targetRoot
    )

    $previousCompiledWasmPath = $env:DX_ZED_COMPILED_WASM_PATH
    $env:DX_ZED_COMPILED_WASM_PATH = $compiledWasmPath

    try {
        Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-zed-extension-output.ts")
    }
    finally {
        if ($null -eq $previousCompiledWasmPath) {
            Remove-Item Env:\DX_ZED_COMPILED_WASM_PATH -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_ZED_COMPILED_WASM_PATH = $previousCompiledWasmPath
        }
    }

    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
