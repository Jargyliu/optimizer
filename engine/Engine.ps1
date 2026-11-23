<#
  Tickrate engine entry point. Windows PowerShell 5.1 compatible.

  The Electron app writes a JSON request file and runs:
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File Engine.ps1 -Request req.json -Response res.json

  Progress lines are written to stdout prefixed with "@@LOG ".
  The result is written to the response file as { ok, data, error }.
  You can also call it by hand for scripting / debugging.
#>
param(
    [Parameter(Mandatory = $true)][string]$Request,
    [Parameter(Mandatory = $true)][string]$Response
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false } catch { }

$script:DataRoot = Join-Path $env:ProgramData 'Tickrate'
New-Item -ItemType Directory -Path $script:DataRoot -Force | Out-Null

function Write-TRLog {
    param([string]$Message)
    [Console]::Out.WriteLine('@@LOG ' + $Message)
    [Console]::Out.Flush()
}

foreach ($lib in 'Registry', 'Tweaks', 'Games', 'Scan', 'Cleanup', 'System', 'Nvidia') {
    . (Join-Path $PSScriptRoot "lib\$lib.ps1")
}

function Test-TRAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-TRRequest {
    param($Req)
    $p = $Req.payload
    if ($Req.action -like 'tweaks.*') {
        # The CPU class is always determined locally so CPU-specific tweaks cannot be forced onto the wrong CPU.
        if ($null -eq $p.ctx) { $p.ctx = @{} }
        if ($null -eq $p.ctx.games) { $p.ctx.games = Get-TRGames }
        $p.ctx.cpuClass = Get-TRCpuClass ((Get-CimInstance Win32_Processor | Select-Object -First 1).Name)
    }
    switch ($Req.action) {
        'ping' { return @{ admin = (Test-TRAdmin); psVersion = $PSVersionTable.PSVersion.ToString(); dataRoot = $script:DataRoot } }

        'tweaks.detect' {
            $state = Get-TRState
            $out = @{}
            foreach ($t in @($p.tweaks)) { $out[$t.id] = Get-TRTweakStatus $t $p.ctx $state }
            return $out
        }
        'tweaks.apply' {
            $state = Get-TRState
            $out = @{}
            foreach ($t in @($p.tweaks)) {
                Write-TRLog "Applying: $($t.title)"
                $r = Invoke-TRTweakApply $t $p.ctx $state
                foreach ($e in $r.errors) { Write-TRLog "  ! $e" }
                $out[$t.id] = $r
                Save-TRState $state
            }
            return $out
        }
        'tweaks.revert' {
            $state = Get-TRState
            $out = @{}
            foreach ($t in @($p.tweaks)) {
                Write-TRLog "Reverting: $($t.title)"
                $r = Invoke-TRTweakRevert $t $p.ctx $state
                foreach ($e in $r.errors) { Write-TRLog "  ! $e" }
                $out[$t.id] = $r
                Save-TRState $state
            }
            return $out
        }
        'state.get' { return Get-TRState }

        'scan' { return Get-TRScan }
        'games.detect' { return Get-TRGames }

        'cleanup.analyze' { return Invoke-TRCleanupAnalyze }
        'cleanup.run' { return Invoke-TRCleanupRun -Ids @($p.ids) }

        'restore.status' { return Get-TRRestoreStatus }
        'restore.create' { return New-TRRestorePoint -Description $p.description -EnableIfOff ([bool]$p.enableIfOff) }
        'restore.open' { Start-Process "$env:SystemRoot\System32\rstrui.exe"; return @{} }

        'startup.list' { return Get-TRStartupItems }
        'startup.set' { Set-TRStartupItem -Id $p.id -Enabled ([bool]$p.enabled); return Get-TRStartupItems }

        'apps.list' { return Get-TRApps -Patterns @($p.patterns) }
        'apps.remove' { return Remove-TRApps -Patterns @($p.patterns) -Deprovision ([bool]$p.deprovision) }

        'maint.run' { return Invoke-TRMaintenance -Task $p.task }

        'power.list' { return Get-TRPowerPlans }
        'power.activate' { return Set-TRPowerPlanActive -Guid $p.guid }

        'nvidia.status' { return Get-TRNvidiaStatus }
        'nvidia.install' { return Install-TRNvpi }
        'nvidia.read' { return Read-TRNvidiaBaseProfile }
        'nvidia.apply' { return Invoke-TRNvidiaApply -Settings @($p.settings) }
        'nvidia.revert' { return Invoke-TRNvidiaRevert }

        default { throw "Unknown action '$($Req.action)'" }
    }
}

$result = $null
try {
    $raw = [IO.File]::ReadAllText($Request)
    $req = ConvertTo-TRHashtable ($raw | ConvertFrom-Json)
    # Actions that return a list must stay a JSON array even with 0 or 1 items.
    $listActions = @('startup.list', 'startup.set', 'power.list', 'power.activate')
    if ($listActions -contains $req.action) { $data = @(Invoke-TRRequest $req) } else { $data = Invoke-TRRequest $req }
    $result = @{ ok = $true; data = $data }
} catch {
    $msg = $_.Exception.Message
    Write-TRLog "ERROR: $msg"
    $result = @{ ok = $false; error = $msg; where = "$($_.InvocationInfo.ScriptName):$($_.InvocationInfo.ScriptLineNumber)" }
}
$json = $result | ConvertTo-Json -Depth 20 -Compress
$dir = Split-Path $Response -Parent
if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
[IO.File]::WriteAllText($Response, $json, (New-Object Text.UTF8Encoding $false))
