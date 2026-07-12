param(
  [Parameter(Mandatory = $true)][int]$X,
  [Parameter(Mandatory = $true)][int]$Y
)

$ErrorActionPreference = 'Stop'

function Test-ExcludedWindowTitle([string]$Title) {
  $t = $Title.Trim().ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($t)) { return $true }
  if ($t.Contains('arc screenshot area picker')) { return $true }
  if ($t.Contains('arc screenshot window picker')) { return $true }
  if ($t.Contains('artist reference collection')) { return $true }
  return $false
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ArcWin32Window {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int count);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

$script:TargetX = $X
$script:TargetY = $Y
$script:Found = $null

$callback = [ArcWin32Window+EnumWindowsProc]{
  param([IntPtr]$hWnd, [IntPtr]$lParam)

  if (-not [ArcWin32Window]::IsWindowVisible($hWnd)) { return $true }
  if ([ArcWin32Window]::IsIconic($hWnd)) { return $true }

  $rect = New-Object ArcWin32Window+RECT
  if (-not [ArcWin32Window]::GetWindowRect($hWnd, [ref]$rect)) { return $true }

  if ($script:TargetX -lt $rect.Left -or $script:TargetX -ge $rect.Right) { return $true }
  if ($script:TargetY -lt $rect.Top -or $script:TargetY -ge $rect.Bottom) { return $true }

  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -lt 8 -or $height -lt 8) { return $true }

  $sb = New-Object System.Text.StringBuilder 512
  [void][ArcWin32Window]::GetWindowText($hWnd, $sb, 512)
  $title = $sb.ToString()
  if (Test-ExcludedWindowTitle $title) { return $true }

  $script:Found = [ordered]@{
    title = $title
    nativeId = [int64]$hWnd
    x = $rect.Left
    y = $rect.Top
    width = [Math]::Max(1, $width)
    height = [Math]::Max(1, $height)
  }

  return $false
}

[void][ArcWin32Window]::EnumWindows($callback, [IntPtr]::Zero)

if ($null -eq $script:Found) { exit 1 }

ConvertTo-Json -Compress $script:Found
