# Удаление профиля и служебных данных ARC при деинсталляции (не при автообновлении).
# Папку библиотеки с медиафайлами пользователя не трогаем.
$ErrorActionPreference = 'SilentlyContinue'

function Remove-Tree([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return }
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

$appDataDirs = @(
  (Join-Path $env:APPDATA 'ARC'),
  (Join-Path $env:APPDATA 'artist-reference-collection'),
  (Join-Path $env:APPDATA 'artist-reference-collection-dev')
)

$localAppDataDirs = @(
  (Join-Path $env:LOCALAPPDATA 'ARC'),
  (Join-Path $env:LOCALAPPDATA 'artist-reference-collection'),
  (Join-Path $env:LOCALAPPDATA 'artist-reference-collection-dev'),
  (Join-Path $env:LOCALAPPDATA 'artist-reference-collection-updater'),
  (Join-Path $env:LOCALAPPDATA 'ARC-updater')
)

foreach ($dir in ($appDataDirs + $localAppDataDirs)) {
  Remove-Tree $dir
}

Remove-Tree (Join-Path $env:TEMP 'arc-screenshots')
