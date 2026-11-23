# Registry helpers built on Microsoft.Win32 so value kinds are preserved exactly.
# Paths use the short form 'HKLM\SOFTWARE\...' or 'HKCU\Software\...'.

function Get-TRBaseKey {
    param([string]$Hive)
    $view = [Microsoft.Win32.RegistryView]::Registry64
    switch ($Hive.ToUpperInvariant()) {
        'HKLM' { return [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, $view) }
        'HKCU' { return [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, $view) }
        'HKCR' { return [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::ClassesRoot, $view) }
        'HKU'  { return [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::Users, $view) }
        default { throw "Unsupported hive '$Hive'" }
    }
}

function Split-TRRegPath {
    param([string]$Path)
    $idx = $Path.IndexOf('\')
    if ($idx -lt 0) { return @{ Hive = $Path; Sub = '' } }
    return @{ Hive = $Path.Substring(0, $idx); Sub = $Path.Substring($idx + 1) }
}

function Open-TRRegKey {
    param([string]$Path, [switch]$Writable, [switch]$Create)
    $p = Split-TRRegPath $Path
    $base = Get-TRBaseKey $p.Hive
    if ($p.Sub -eq '') { return $base }
    if ($Create) { return $base.CreateSubKey($p.Sub, $true) }
    return $base.OpenSubKey($p.Sub, [bool]$Writable)
}

function Test-TRRegKey {
    param([string]$Path)
    $k = Open-TRRegKey $Path
    if ($null -eq $k) { return $false }
    $k.Close()
    return $true
}

# Returns the shallowest key in $Path that does not exist yet (or $null if the key exists).
function Get-TRMissingAncestor {
    param([string]$Path)
    if (Test-TRRegKey $Path) { return $null }
    $parts = $Path.Split('\')
    $current = $parts[0]
    for ($i = 1; $i -lt $parts.Length; $i++) {
        $current = "$current\$($parts[$i])"
        if (-not (Test-TRRegKey $current)) { return $current }
    }
    return $Path
}

function ConvertTo-TRUInt32 {
    param($Value)
    $n = [int64]$Value
    if ($n -lt 0) { $n += 4294967296 }
    return [uint32]$n
}

function ConvertTo-TRInt32Bits {
    param($Value)
    $u = [uint32]([int64]$Value -band 0xFFFFFFFFL)
    return [BitConverter]::ToInt32([BitConverter]::GetBytes($u), 0)
}

function ConvertTo-TRByteArray {
    param($Value)
    if ($Value -is [string]) {
        $hex = $Value -replace '[^0-9A-Fa-f]', ''
        $bytes = New-Object byte[] ($hex.Length / 2)
        for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16) }
        return ,$bytes
    }
    return ,([byte[]]@($Value))
}

function Read-TRRegValue {
    param([string]$Path, [string]$Name)
    $result = @{ keyExists = $false; exists = $false; kind = $null; value = $null }
    $k = Open-TRRegKey $Path
    if ($null -eq $k) { return $result }
    try {
        $result.keyExists = $true
        if ($k.GetValueNames() -notcontains $Name) { return $result }
        $kind = $k.GetValueKind($Name)
        $raw = $k.GetValue($Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        $result.exists = $true
        $result.kind = $kind.ToString()
        switch ($kind) {
            'DWord'  { $result.value = [int64](ConvertTo-TRUInt32 $raw) }
            'QWord'  { $result.value = [int64]$raw }
            'Binary' { $result.value = (($raw | ForEach-Object { $_.ToString('X2') }) -join '') }
            'MultiString' { $result.value = @($raw) }
            default  { $result.value = [string]$raw }
        }
        return $result
    } finally { $k.Close() }
}

function Write-TRRegValue {
    param([string]$Path, [string]$Name, [string]$Kind, $Value)
    $k = Open-TRRegKey $Path -Create
    if ($null -eq $k) { throw "Could not open or create $Path" }
    try {
        $rk = [Microsoft.Win32.RegistryValueKind]$Kind
        switch ($rk) {
            'DWord'        { $k.SetValue($Name, (ConvertTo-TRInt32Bits $Value), $rk) }
            'QWord'        { $k.SetValue($Name, [int64]$Value, $rk) }
            'Binary'       { $k.SetValue($Name, (ConvertTo-TRByteArray $Value), $rk) }
            'MultiString'  { $k.SetValue($Name, [string[]]@($Value), $rk) }
            default        { $k.SetValue($Name, [string]$Value, $rk) }
        }
    } finally { $k.Close() }
}

function Remove-TRRegValue {
    param([string]$Path, [string]$Name)
    $k = Open-TRRegKey $Path -Writable
    if ($null -eq $k) { return }
    try {
        if ($k.GetValueNames() -contains $Name) { $k.DeleteValue($Name, $false) }
    } finally { $k.Close() }
}

# True when a key and all of its subkeys hold no values.
function Test-TRRegTreeEmpty {
    param([string]$Path)
    $k = Open-TRRegKey $Path
    if ($null -eq $k) { return $true }
    try {
        if ($k.ValueCount -gt 0) { return $false }
        foreach ($child in $k.GetSubKeyNames()) {
            if (-not (Test-TRRegTreeEmpty "$Path\$child")) { return $false }
        }
        return $true
    } finally { $k.Close() }
}

function Remove-TRRegKeyTree {
    param([string]$Path)
    $p = Split-TRRegPath $Path
    if ($p.Sub -eq '') { return }
    $base = Get-TRBaseKey $p.Hive
    try { $base.DeleteSubKeyTree($p.Sub, $false) } finally { $base.Close() }
}

function Test-TRRegValueEquals {
    param($Current, [string]$Kind, $Desired)
    if (-not $Current.exists) { return $false }
    switch ($Kind) {
        'DWord' { return ([int64]$Current.value -eq [int64](ConvertTo-TRUInt32 $Desired)) }
        'QWord' { return ([int64]$Current.value -eq [int64]$Desired) }
        'Binary' {
            $want = ((ConvertTo-TRByteArray $Desired) | ForEach-Object { $_.ToString('X2') }) -join ''
            return ($Current.value -eq $want)
        }
        'MultiString' { return ((@($Current.value) -join "`n") -eq (@($Desired) -join "`n")) }
        default { return ([string]$Current.value -eq [string]$Desired) }
    }
}
