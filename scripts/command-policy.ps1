Set-StrictMode -Version Latest

function Set-DxSerialBuildEnvironment {
    $env:CI = "1"
    $env:CARGO_BUILD_JOBS = "1"
    $env:RUST_TEST_THREADS = "1"
    $env:CARGO_TERM_COLOR = "never"
    $env:CARGO_TERM_PROGRESS_WHEN = "never"
    $env:NODE_OPTIONS = "--max-old-space-size=2048"
    $env:npm_config_audit = "false"
    $env:npm_config_fund = "false"
    $env:npm_config_progress = "false"
    $env:CHILD_CONCURRENCY = "1"
    $env:pnpm_config_workspace_concurrency = "1"
    $env:pnpm_config_child_concurrency = "1"
}

function Assert-DxDriveSpace {
    param(
        [Parameter(Mandatory = $true)]
        [int] $MinimumFreeGiB
    )

    $drive = Get-PSDrive -Name G -ErrorAction Stop
    $freeGiB = [math]::Round($drive.Free / 1GB, 2)
    if ($drive.Free -lt ($MinimumFreeGiB * 1GB)) {
        throw "Environment blocker: G: has ${freeGiB}GiB free; ${MinimumFreeGiB}GiB required."
    }
}

function Get-DxCurrentProcessAncestryIds {
    $ignoredIds = @([int]$PID)
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction SilentlyContinue

    while ($current -and $current.ParentProcessId -and $ignoredIds.Count -lt 12) {
        $ignoredIds += [int]$current.ParentProcessId
        $parentId = [int]$current.ParentProcessId
        $current = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId" -ErrorAction SilentlyContinue
    }

    return $ignoredIds
}

function Get-DxCompetingHeavyProcess {
    param(
        [Parameter()]
        [int[]] $IgnoredIds = @()
    )

    $names = @("cargo", "rustc", "next", "turbo")

    return Get-Process -ErrorAction SilentlyContinue |
        Where-Object {
            $names -contains $_.ProcessName -and -not ($IgnoredIds -contains $_.Id)
        }
}

function Format-DxCompetingHeavyProcessSummary {
    param(
        [Parameter(Mandatory = $true)]
        [object[]] $Processes
    )

    return ($Processes | Select-Object -First 8 | ForEach-Object {
        "$($_.ProcessName):$($_.Id)"
    }) -join ", "
}

function Get-DxHeavyProcessGuardTimeoutSeconds {
    $value = $env:DX_HEAVY_PROCESS_GUARD_TIMEOUT_SECONDS

    if ([string]::IsNullOrWhiteSpace($value)) {
        return 600
    }

    $parsed = 0
    if ([int]::TryParse($value, [ref]$parsed) -and $parsed -gt 0) {
        return $parsed
    }

    throw "DX_HEAVY_PROCESS_GUARD_TIMEOUT_SECONDS must be a positive integer."
}

function Assert-NoCompetingHeavyProcess {
    param(
        [Parameter()]
        [int] $TimeoutSeconds = (Get-DxHeavyProcessGuardTimeoutSeconds),
        [Parameter()]
        [int] $PollSeconds = 5
    )

    if ($TimeoutSeconds -le 0) {
        throw "Heavy process guard timeout must be positive."
    }

    if ($PollSeconds -le 0) {
        throw "Heavy process guard poll interval must be positive."
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ($true) {
        $ignoredIds = Get-DxCurrentProcessAncestryIds
        $processes = @(Get-DxCompetingHeavyProcess -IgnoredIds $ignoredIds)

        if ($processes.Count -eq 0) {
            return
        }

        $summary = Format-DxCompetingHeavyProcessSummary -Processes $processes
        $now = Get-Date

        if ($now -ge $deadline) {
            throw "Environment blocker: competing heavy process detected after ${TimeoutSeconds}s: $summary"
        }

        $remainingSeconds = [math]::Max(1, [int][math]::Ceiling(($deadline - $now).TotalSeconds))
        $sleepSeconds = [math]::Min($PollSeconds, $remainingSeconds)
        Write-Host "Waiting for competing heavy process to finish: $summary"
        Start-Sleep -Seconds $sleepSeconds
    }
}

function Assert-DxCommandPolicy {
    param(
        [Parameter(Mandatory = $true)]
        [string] $FilePath,
        [Parameter()]
        [string[]] $Arguments = @()
    )

    $commandName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath).ToLowerInvariant()

    if ($commandName -eq "cargo" -and (Test-DxCargoHeavyCommand -Arguments $Arguments)) {
        if (-not (Test-DxSerialCargoJobArgument -Arguments $Arguments)) {
            throw "Cargo heavy commands must include -j 1."
        }
    }

    if ($commandName -eq "npm" -and (Test-DxNpmWorkspaceFanOut -Arguments $Arguments)) {
        throw "npm workspace fan-out is not allowed for heavy commands."
    }

    if ($commandName -eq "npm" -and (Test-DxNpmWorkspaceLocalBypass -Arguments $Arguments)) {
        throw "Use the root j1 wrapper for heavy workspace scripts."
    }
}

function Test-DxCargoHeavyCommand {
    param(
        [Parameter()]
        [string[]] $Arguments = @()
    )

    $heavyCommands = @("build", "check", "test", "clippy")
    foreach ($argument in $Arguments) {
        if ($heavyCommands -contains $argument) {
            return $true
        }
    }

    return $false
}

function Test-DxSerialCargoJobArgument {
    param(
        [Parameter()]
        [string[]] $Arguments = @()
    )

    for ($index = 0; $index -lt $Arguments.Count; $index += 1) {
        $argument = $Arguments[$index]

        if ($argument -eq "-j1" -or $argument -eq "--jobs=1") {
            return $true
        }

        if (($argument -eq "-j" -or $argument -eq "--jobs") -and $index + 1 -lt $Arguments.Count) {
            return $Arguments[$index + 1] -eq "1"
        }
    }

    return $false
}

function Test-DxNpmWorkspaceFanOut {
    param(
        [Parameter()]
        [string[]] $Arguments = @()
    )

    $usesAllWorkspaces = $Arguments -contains "--workspaces"
    $runsScript = $Arguments -contains "run"
    $heavyScripts = @("build", "check", "test", "package")

    if (-not ($usesAllWorkspaces -and $runsScript)) {
        return $false
    }

    foreach ($argument in $Arguments) {
        if ($heavyScripts -contains $argument) {
            return $true
        }
    }

    return $false
}

function Test-DxNpmWorkspaceLocalBypass {
    param(
        [Parameter()]
        [string[]] $Arguments = @()
    )

    $usesSingleWorkspace = $Arguments -contains "--workspace" -or $Arguments -contains "-w"
    $runIndex = [array]::IndexOf($Arguments, "run")
    $forbiddenScripts = @("check:local", "build:local", "build:artifacts:local", "package:local", "test:local")

    if (-not $usesSingleWorkspace -or $runIndex -lt 0 -or $runIndex + 1 -ge $Arguments.Count) {
        return $false
    }

    return $forbiddenScripts -contains $Arguments[$runIndex + 1]
}

function Invoke-DxCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string] $FilePath,
        [Parameter()]
        [string[]] $Arguments = @()
    )

    Assert-DxCommandPolicy -FilePath $FilePath -Arguments $Arguments

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
}

function Invoke-DxInternalWorkspaceScript {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Workspace,
        [Parameter(Mandatory = $true)]
        [string] $ScriptName,
        [Parameter()]
        [string[]] $Arguments = @()
    )

    $previousWrapperMarker = $env:DX_EXTENSIONS_J1_WRAPPER
    $env:DX_EXTENSIONS_J1_WRAPPER = "1"

    try {
        Invoke-DxCommand "npm" (@("--workspace", $Workspace, "run", $ScriptName) + $Arguments)
    }
    finally {
        if ($null -eq $previousWrapperMarker) {
            Remove-Item Env:\DX_EXTENSIONS_J1_WRAPPER -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_EXTENSIONS_J1_WRAPPER = $previousWrapperMarker
        }
    }
}
