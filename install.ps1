# SAKURA PANEL - one-line installer for Windows
#
#   irm https://raw.githubusercontent.com/tfem1/sakura-panel/main/install.ps1 | iex
#
# What it does:
#   1. Makes sure Git and Node.js LTS are installed (installs them with winget if missing)
#   2. git clone (or git pull if already installed) into %LOCALAPPDATA%\SakuraPanel
#   3. npm install (downloads Electron)
#   4. Creates "SAKURA PANEL" shortcuts on the Desktop and in the Start menu
#   5. Launches the app
#
# Run it again at any time to update. Set $env:SAKURA_PANEL_DIR first to choose another folder.

& {
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoUrl = 'https://github.com/tfem1/sakura-panel.git'
$AppName = 'SAKURA PANEL'
$Dir = if ($env:SAKURA_PANEL_DIR) { $env:SAKURA_PANEL_DIR } else { Join-Path $env:LOCALAPPDATA 'SakuraPanel' }

function Write-Step([string]$Message) { Write-Host "  > $Message" -ForegroundColor Magenta }
function Write-Done([string]$Message) { Write-Host "  + $Message" -ForegroundColor Green }
function Test-Command([string]$Name) { [bool](Get-Command $Name -ErrorAction SilentlyContinue) }
function Update-SessionPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Invoke-Native([string]$What, [scriptblock]$Command) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit code $LASTEXITCODE)." }
}

function Install-Requirement([string]$Command, [string]$WingetId, [string]$Name, [string]$Url) {
  if (Test-Command $Command) { Write-Done "$Name found"; return }
  if (-not (Test-Command 'winget')) {
    throw "$Name is required but was not found, and winget is not available. Install $Name from $Url, then run this command again."
  }
  Write-Step "Installing $Name with winget"
  winget install --id $WingetId --exact --source winget --silent --accept-package-agreements --accept-source-agreements | Out-Host
  Update-SessionPath
  if (-not (Test-Command $Command)) {
    throw "$Name was installed but is not on PATH in this window yet. Open a new PowerShell window and run the install command again."
  }
  Write-Done "$Name installed"
}

function New-AppShortcut([string]$Folder, [string]$Target, [string]$Arguments, [string]$Icon, [string]$WorkDir) {
  if (-not (Test-Path $Folder)) { New-Item -ItemType Directory -Path $Folder -Force | Out-Null }
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut((Join-Path $Folder "$AppName.lnk"))
  $lnk.TargetPath = $Target
  $lnk.Arguments = $Arguments
  $lnk.WorkingDirectory = $WorkDir
  $lnk.IconLocation = "$Icon,0"
  $lnk.Description = $AppName
  $lnk.Save()
}

try {
  Write-Host ''
  Write-Host '  SAKURA PANEL - installer' -ForegroundColor White
  Write-Host "  Folder: $Dir" -ForegroundColor DarkGray
  Write-Host ''

  Install-Requirement 'git' 'Git.Git' 'Git' 'https://git-scm.com/download/win'
  Install-Requirement 'node' 'OpenJS.NodeJS.LTS' 'Node.js LTS' 'https://nodejs.org'

  # Close a running copy so npm can replace Electron's files.
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Dir, [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue

  if (Test-Path (Join-Path $Dir '.git')) {
    Write-Step 'Updating (git pull)'
    Invoke-Native 'git pull' { git -C $Dir pull --ff-only }
  } elseif ((Test-Path $Dir) -and (Get-ChildItem -Force $Dir | Select-Object -First 1)) {
    throw "$Dir already exists and is not a SAKURA PANEL clone. Remove it or set `$env:SAKURA_PANEL_DIR to another folder."
  } else {
    Write-Step 'Downloading (git clone)'
    Invoke-Native 'git clone' { git clone --depth 1 $RepoUrl $Dir }
  }

  Write-Step 'Installing dependencies (npm install) - this can take a minute'
  Push-Location $Dir
  try { Invoke-Native 'npm install' { npm.cmd install --no-audit --no-fund --loglevel=error } } finally { Pop-Location }

  $electron = Join-Path $Dir 'node_modules\electron\dist\electron.exe'
  $icon = Join-Path $Dir 'assets\icons\sakura-panel.ico'
  if (-not (Test-Path $electron)) { throw "Electron was not downloaded ($electron is missing). Run the install command again." }
  $arguments = '"' + $Dir + '"'

  Write-Step 'Creating shortcuts'
  New-AppShortcut ([Environment]::GetFolderPath('Desktop')) $electron $arguments $icon $Dir
  New-AppShortcut ([Environment]::GetFolderPath('Programs')) $electron $arguments $icon $Dir
  Write-Done 'Desktop and Start menu shortcuts created'

  Write-Step "Starting $AppName"
  Start-Process -FilePath $electron -ArgumentList $arguments -WorkingDirectory $Dir

  Write-Host ''
  Write-Done "$AppName is installed. Run the same command again to update."
  Write-Host '    Uninstall: irm https://raw.githubusercontent.com/tfem1/sakura-panel/main/uninstall.ps1 | iex' -ForegroundColor DarkGray
  Write-Host ''
} catch {
  Write-Host ''
  Write-Host "  x Installation failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ''
}
}
