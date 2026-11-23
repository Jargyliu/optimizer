<#
  End-to-end engine test for a disposable Windows machine (GitHub Actions windows runner).
  DO NOT run this on your own PC: it applies and reverts every tweak.

  For each tweak it:
    1. snapshots every registry value / service start type the tweak touches
    2. applies it through Engine.ps1 (exactly like the app does) and checks it reports "applied" (or "na")
    3. reverts it and checks every snapshotted value is byte-for-byte back to the original
  It also smoke-tests every read-only engine action.

  Usage: powershell -ExecutionPolicy Bypass -File tests\engine.roundtrip.ps1 -Catalog build\catalog.json
#>
param([Parameter(Mandatory = $true)][string]$Catalog)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$engine = Join-Path $root 'engine\Engine.ps1'
. (Join-Path $root 'engine\lib\Registry.ps1')

# Tweaks that reset the network adapter would cut the CI runner's connection.
$skip = @('net.adapter-power-saving-off', 'net.interrupt-moderation-off')

$script:failures = New-Object System.Collections.Generic.List[string]
function Fail([string]$m) { $script:failures.Add($m); Write-Host "  FAIL $m" -ForegroundColor Red }
function Pass([string]$m) { Write-Host "  ok   $m" -ForegroundColor Green }

function Invoke-Engine([string]$Action, $Payload) {
    $tmp = Join-Path $env:TEMP ("tr-test-" + [guid]::NewGuid())
    $req = "$tmp-req.json"; $res = "$tmp-res.json"
    [IO.File]::WriteAllText($req, (@{ action = $Action; payload = $Payload } | ConvertTo-Json -Depth 30 -Compress), (New-Object Text.UTF8Encoding $false))
    $ErrorActionPreference = 'Continue'
    $out = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $engine -Request $req -Response $res 2>&1
    $r = [IO.File]::ReadAllText($res) | ConvertFrom-Json
    Remove-Item $req, $res -Force -ErrorAction SilentlyContinue
    if (-not $r.ok) { throw "$Action failed: $($r.error) at $($r.where)`n$($out -join "`n")" }
    return $r.data
}

function Get-Snapshot($Tweak) {
    $snap = @{}
    foreach ($op in @($Tweak.ops)) {
        if ($op.op -eq 'reg') { $snap["reg|$($op.path)|$($op.name)"] = (Read-TRRegValue $op.path $op.name | ConvertTo-Json -Compress) }
        if ($op.op -eq 'service') { $snap["svc|$($op.name)"] = (Read-TRRegValue "HKLM\SYSTEM\CurrentControlSet\Services\$($op.name)" 'Start' | ConvertTo-Json -Compress) }
        if ($op.op -eq 'task') {
            $t = Get-ScheduledTask -TaskPath $op.path -TaskName $op.name -ErrorAction SilentlyContinue
            $snap["task|$($op.path)$($op.name)"] = $(if ($t) { [string]$t.State } else { 'missing' })
        }
        if ($op.op -eq 'reg' -or $op.op -eq 'service') { }
    }
    $snap['power'] = ((& powercfg.exe /getactivescheme) -join ' ')
    return $snap
}

$cat = Get-Content -Raw $Catalog | ConvertFrom-Json
$games = @{ fortnite = @{ installed = $false }; valorant = @{ installed = $false } }

Write-Host "`n== read-only actions" -ForegroundColor Cyan
$ping = Invoke-Engine 'ping' @{}
if ($ping.admin) { Pass 'ping (admin)' } else { Fail 'ping: not running as administrator' }
foreach ($a in 'startup.list', 'power.list') {
    try { $d = Invoke-Engine $a @{}; if ($d -isnot [array]) { Fail "$a did not return a JSON array" } } catch { }
}
foreach ($a in 'scan', 'games.detect', 'cleanup.analyze', 'restore.status', 'startup.list', 'power.list', 'nvidia.status', 'state.get') {
    try { $null = Invoke-Engine $a @{}; Pass $a } catch { Fail "$a -> $($_.Exception.Message)" }
}
try { $null = Invoke-Engine 'apps.list' @{ patterns = @($cat.apps | ForEach-Object { $_.pattern }) }; Pass 'apps.list' } catch { Fail "apps.list -> $($_.Exception.Message)" }
try {
    $scan = Invoke-Engine 'scan' @{}
    if (-not $scan.cpu.name) { Fail 'scan returned no CPU name' } else { Pass "scan cpu: $($scan.cpu.name) [$($scan.cpu.class)]" }
    # The UI relies on these being JSON arrays even when there is only one GPU / display / disk.
    foreach ($field in 'gpus', 'gpuMsi', 'displays') { if ($scan.$field -isnot [array]) { Fail "scan.$field is not a JSON array" } else { Pass "scan.$field is an array ($(@($scan.$field).Count))" } }
    if ($scan.storage.disks -isnot [array]) { Fail 'scan.storage.disks is not a JSON array' }
    if ($scan.software.backgroundApps -isnot [array]) { Fail 'scan.software.backgroundApps is not a JSON array' }
} catch { Fail "scan -> $($_.Exception.Message)" }

Write-Host "`n== detect all tweaks" -ForegroundColor Cyan
$ctx = @{ games = $games; cpuClass = 'other' }
$initial = Invoke-Engine 'tweaks.detect' @{ tweaks = @($cat.tweaks); ctx = $ctx }
foreach ($t in $cat.tweaks) {
    $s = $initial.($t.id)
    if (-not $s) { Fail "$($t.id): no status"; continue }
    if (@('applied', 'default', 'partial', 'na') -notcontains $s.status) { Fail "$($t.id): bad status $($s.status)" }
    if (@($s.errors).Count -gt 0) { Fail "$($t.id): detect errors: $($s.errors -join '; ')" }
}
Pass "detected $(@($cat.tweaks).Count) tweaks"

Write-Host "`n== apply / revert round trip" -ForegroundColor Cyan
foreach ($t in $cat.tweaks) {
    if ($skip -contains $t.id) { Write-Host "  skip $($t.id)"; continue }
    if ($initial.($t.id).status -eq 'na') { Write-Host "  n/a  $($t.id)"; continue }
    try {
        $before = Get-Snapshot $t
        $ap = Invoke-Engine 'tweaks.apply' @{ tweaks = @($t); ctx = $ctx }
        $r = $ap.($t.id)
        if (-not $r.ok) { Fail "$($t.id) apply: $($r.errors -join '; ')"; continue }
        $mid = (Invoke-Engine 'tweaks.detect' @{ tweaks = @($t); ctx = $ctx }).($t.id).status
        if ($mid -ne 'applied') { Fail "$($t.id): status after apply is '$mid' (expected 'applied')" }
        $rv = (Invoke-Engine 'tweaks.revert' @{ tweaks = @($t); ctx = $ctx }).($t.id)
        if (-not $rv.ok) { Fail "$($t.id) revert: $($rv.errors -join '; ')"; continue }
        $after = Get-Snapshot $t
        $diff = @($before.Keys | Where-Object { $before[$_] -ne $after[$_] })
        if ($diff.Count) { foreach ($k in $diff) { Fail "$($t.id): '$k' not restored. before=$($before[$k]) after=$($after[$k])" } }
        $end = (Invoke-Engine 'tweaks.detect' @{ tweaks = @($t); ctx = $ctx }).($t.id).status
        if ($end -ne $initial.($t.id).status) { Fail "$($t.id): status after revert '$end' != initial '$($initial.($t.id).status)'" }
        if (-not $diff.Count) { Pass "$($t.id) ($mid -> $end)" }
    } catch { Fail "$($t.id): $($_.Exception.Message)" }
}

Write-Host "`n== batch apply + revert everything" -ForegroundColor Cyan
$batch = @($cat.tweaks | Where-Object { $skip -notcontains $_.id -and $_.presets -contains 'extreme' -and $initial.($_.id).status -ne 'na' })
$snaps = @{}; foreach ($t in $batch) { $snaps[$t.id] = Get-Snapshot $t }
$null = Invoke-Engine 'tweaks.apply' @{ tweaks = $batch; ctx = $ctx }
$state = Invoke-Engine 'state.get' @{}
$tracked = @($state.tweaks.PSObject.Properties | ForEach-Object { $_.Name })
if ($tracked.Count -lt $batch.Count) { Fail "state.json tracks $($tracked.Count) of $($batch.Count) tweaks" } else { Pass "state.json tracks $($tracked.Count) tweaks" }
$rv = Invoke-Engine 'tweaks.revert' @{ tweaks = $batch; ctx = $ctx }
foreach ($t in $batch) { $r = $rv.($t.id); if (-not $r.ok) { Fail "batch revert $($t.id): $($r.errors -join '; ')" } }
foreach ($t in $batch) {
    $after = Get-Snapshot $t
    foreach ($k in $snaps[$t.id].Keys) { if ($k -ne 'power' -and $snaps[$t.id][$k] -ne $after[$k]) { Fail "batch $($t.id): '$k' not restored" } }
}
$state = Invoke-Engine 'state.get' @{}
$left = @($state.tweaks.PSObject.Properties | ForEach-Object { $_.Name })
if ($left.Count -ne 0) { Fail "state.json still tracks after reverting everything: $($left -join ', ')" } else { Pass 'batch revert left state.json clean' }

Write-Host ''
if ($script:failures.Count) {
    Write-Host "$($script:failures.Count) failure(s)" -ForegroundColor Red
    exit 1
}
Write-Host 'All engine round-trip checks passed.' -ForegroundColor Green
