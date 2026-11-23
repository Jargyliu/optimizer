# System cleanup: analyze sizes, then delete selected categories. Locked files are skipped.

function Get-TRCleanupTargets {
    $la = $env:LOCALAPPDATA
    $win = $env:SystemRoot
    return @(
        @{ id = 'user-temp'; paths = @($env:TEMP) },
        @{ id = 'windows-temp'; paths = @("$win\Temp") },
        @{ id = 'wu-cache'; paths = @("$win\SoftwareDistribution\Download"); services = @('wuauserv', 'bits') },
        @{ id = 'delivery-opt'; special = 'delivery-opt' },
        @{ id = 'nvidia-shader'; paths = @("$la\NVIDIA\DXCache", "$la\NVIDIA\GLCache", "$la\NVIDIA Corporation\NV_Cache", "$env:ProgramData\NVIDIA Corporation\NV_Cache") },
        @{ id = 'd3d-shader'; paths = @("$la\D3DSCache") },
        @{ id = 'crash-dumps'; paths = @("$la\CrashDumps", "$win\Minidump", "$win\LiveKernelReports"); files = @("$win\MEMORY.DMP") },
        @{ id = 'wer'; paths = @("$env:ProgramData\Microsoft\Windows\WER\ReportArchive", "$env:ProgramData\Microsoft\Windows\WER\ReportQueue", "$la\Microsoft\Windows\WER") },
        @{ id = 'thumbnails'; glob = "$la\Microsoft\Windows\Explorer\thumbcache_*.db" },
        @{ id = 'fortnite-logs'; paths = @("$la\FortniteGame\Saved\Logs", "$la\FortniteGame\Saved\Crashes") },
        @{ id = 'valorant-logs'; paths = @("$la\VALORANT\Saved\Logs", "$la\VALORANT\Saved\Crashes", "$la\Riot Games\Riot Client\Logs") },
        @{ id = 'epic-webcache'; globDirs = "$la\EpicGamesLauncher\Saved\webcache*"; paths = @("$la\EpicGamesLauncher\Saved\Logs") },
        @{ id = 'windows-logs'; paths = @("$win\Logs\CBS", "$win\Logs\DISM", "$win\Panther"); keepRecentDays = 7 },
        @{ id = 'recycle-bin'; special = 'recycle-bin' }
    )
}

function Get-TRDirStats {
    param([string]$Path)
    $size = 0L; $count = 0
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return @{ bytes = 0L; files = 0 } }
    Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object { $size += $_.Length; $count++ }
    return @{ bytes = $size; files = $count }
}

function Get-TRRecycleBinSize {
    $size = 0L; $count = 0
    try {
        $shell = New-Object -ComObject Shell.Application
        foreach ($item in $shell.Namespace(10).Items()) { $size += [int64]$item.ExtendedProperty('Size'); $count++ }
    } catch { }
    return @{ bytes = $size; files = $count }
}

function Get-TRTargetPaths {
    param($Target)
    $list = @()
    if ($Target.paths) { $list += @($Target.paths) }
    if ($Target.globDirs) { $list += @(Get-Item -Path $Target.globDirs -Force -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer } | ForEach-Object { $_.FullName }) }
    return ,$list
}

function Measure-TRCleanupTarget {
    param($Target)
    if ($Target.special -eq 'recycle-bin') { return Get-TRRecycleBinSize }
    if ($Target.special -eq 'delivery-opt') {
        return Get-TRDirStats "$env:SystemRoot\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache"
    }
    $bytes = 0L; $files = 0
    foreach ($p in (Get-TRTargetPaths $Target)) { $s = Get-TRDirStats $p; $bytes += $s.bytes; $files += $s.files }
    foreach ($f in @($Target.files)) { if ($f -and (Test-Path -LiteralPath $f)) { $bytes += (Get-Item -LiteralPath $f -Force).Length; $files++ } }
    if ($Target.glob) { Get-Item -Path $Target.glob -Force -ErrorAction SilentlyContinue | ForEach-Object { $bytes += $_.Length; $files++ } }
    return @{ bytes = $bytes; files = $files }
}

function Invoke-TRCleanupAnalyze {
    $out = @{}
    foreach ($t in Get-TRCleanupTargets) { $out[$t.id] = Measure-TRCleanupTarget $t }
    return $out
}

function Clear-TRDirectoryContents {
    param([string]$Path, [int]$KeepRecentDays = 0)
    $freed = 0L; $skipped = 0
    if (-not (Test-Path -LiteralPath $Path)) { return @{ freed = 0L; skipped = 0 } }
    $cutoff = (Get-Date).AddDays(-$KeepRecentDays)
    Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ($KeepRecentDays -gt 0 -and $_.LastWriteTime -gt $cutoff) { return }
        $len = $_.Length
        try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop; $freed += $len } catch { $skipped++ }
    }
    # remove now-empty folders (deepest first), keep the root
    Get-ChildItem -LiteralPath $Path -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length } -Descending |
        ForEach-Object { if (-not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue)) { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue } }
    return @{ freed = $freed; skipped = $skipped }
}

function Invoke-TRCleanupRun {
    param([string[]]$Ids)
    $results = @{}
    foreach ($t in Get-TRCleanupTargets) {
        if ($Ids -notcontains $t.id) { continue }
        Write-TRLog "Cleaning $($t.id)"
        $freed = 0L; $skipped = 0
        try {
            if ($t.special -eq 'recycle-bin') {
                $before = (Get-TRRecycleBinSize).bytes
                Clear-RecycleBin -Force -ErrorAction SilentlyContinue
                $freed = $before - (Get-TRRecycleBinSize).bytes
            } elseif ($t.special -eq 'delivery-opt') {
                $before = (Measure-TRCleanupTarget $t).bytes
                Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue
                $freed = $before - (Measure-TRCleanupTarget $t).bytes
            } else {
                $stopped = @()
                foreach ($svc in @($t.services)) {
                    if (-not $svc) { continue }
                    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
                    if ($s -and $s.Status -eq 'Running') { Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue; $stopped += $svc }
                }
                $keep = 0; if ($t.keepRecentDays) { $keep = [int]$t.keepRecentDays }
                foreach ($p in (Get-TRTargetPaths $t)) { $r = Clear-TRDirectoryContents $p $keep; $freed += $r.freed; $skipped += $r.skipped }
                foreach ($f in @($t.files)) {
                    if ($f -and (Test-Path -LiteralPath $f)) { $len = (Get-Item -LiteralPath $f -Force).Length; try { Remove-Item -LiteralPath $f -Force -ErrorAction Stop; $freed += $len } catch { $skipped++ } }
                }
                if ($t.glob) { Get-Item -Path $t.glob -Force -ErrorAction SilentlyContinue | ForEach-Object { $len = $_.Length; try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop; $freed += $len } catch { $skipped++ } } }
                foreach ($svc in $stopped) { Start-Service -Name $svc -ErrorAction SilentlyContinue }
            }
        } catch { Write-TRLog "  $($t.id) failed: $($_.Exception.Message)" }
        if ($freed -lt 0) { $freed = 0 }
        $results[$t.id] = @{ freed = $freed; skipped = $skipped }
    }
    return $results
}
