# SAKURA PANEL - uninstaller
#
#   irm https://raw.githubusercontent.com/tfem1/sakura-panel/main/uninstall.ps1 | iex
#
# Removes the app folder and its shortcuts. Your settings and themes are kept in
# %APPDATA%\SAKURA PANEL; set $env:SAKURA_PANEL_PURGE = '1' first to delete them too.

& {
$ErrorActionPreference = 'Stop'
$AppName = 'SAKURA PANEL'
$Dir = if ($env:SAKURA_PANEL_DIR) { $env:SAKURA_PANEL_DIR } else { Join-Path $env:LOCALAPPDATA 'SakuraPanel' }

try {
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Dir, [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500

  foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
    $lnk = Join-Path $folder "$AppName.lnk"
    if (Test-Path $lnk) { Remove-Item $lnk -Force }
  }

  # Only delete the folder if it really is a SAKURA PANEL install.
  if (Test-Path (Join-Path $Dir 'electron\main.js')) {
    Remove-Item $Dir -Recurse -Force
    Write-Host "  + Removed $Dir" -ForegroundColor Green
  } elseif (Test-Path $Dir) {
    Write-Host "  ! $Dir does not look like a SAKURA PANEL install - left untouched." -ForegroundColor Yellow
  }

  $data = Join-Path $env:APPDATA $AppName
  if ($env:SAKURA_PANEL_PURGE -eq '1' -and (Test-Path $data)) {
    Remove-Item $data -Recurse -Force
    Write-Host "  + Removed settings ($data)" -ForegroundColor Green
  } elseif (Test-Path $data) {
    Write-Host "  Settings kept in $data" -ForegroundColor DarkGray
  }
  Write-Host "  + $AppName uninstalled" -ForegroundColor Green
} catch {
  Write-Host "  x Uninstall failed: $($_.Exception.Message)" -ForegroundColor Red
}
}
