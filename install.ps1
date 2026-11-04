# SAKURA PANEL - one-line installer for Windows
#
#   irm https://raw.githubusercontent.com/tfem1/sakura-panel/main/install.ps1 | iex
#
# What it does:
#   1. Makes sure Git and Node.js LTS are available: uses existing installs, else winget,
#      else a private portable copy in %LOCALAPPDATA%\SakuraPanel-tools (no restart needed)
#   2. git clone (or git pull if already installed) into %LOCALAPPDATA%\SakuraPanel
#   3. npm install, then makes sure the Electron runtime is downloaded
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

$Tools = Join-Path $env:LOCALAPPDATA 'SakuraPanel-tools'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

function Add-PathIfExists([string[]]$Folders) {
  foreach ($f in $Folders) { if ($f -and (Test-Path $f) -and (($env:Path -split ';') -notcontains $f)) { $env:Path = "$f;$env:Path" } }
}

# Where a normal install puts each tool, so a fresh install works without opening a new window.
$KnownDirs = @{
  git  = @("$env:ProgramFiles\Git\cmd", "${env:ProgramFiles(x86)}\Git\cmd", "$env:LOCALAPPDATA\Programs\Git\cmd", "$Tools\git\cmd")
  node = @("$env:ProgramFiles\nodejs", "${env:ProgramFiles(x86)}\nodejs", "$env:LOCALAPPDATA\Programs\nodejs", "$Tools\node")
}

function Get-Zip([string]$Url, [string]$Dest) {
  $zip = Join-Path $env:TEMP ([IO.Path]::GetRandomFileName() + '.zip')
  try {
    Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing
    if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $Dest -Force
  } finally { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
}

# Portable fallbacks, used only when winget is missing or fails. Private to SAKURA PANEL.
function Install-PortableNode {
  $lts = (Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing | Where-Object { $_.lts } | Select-Object -First 1).version
  $name = "node-$lts-win-x64"
  $tmp = Join-Path $Tools 'node-extract'
  Get-Zip "https://nodejs.org/dist/$lts/$name.zip" $tmp
  if (Test-Path "$Tools\node") { Remove-Item "$Tools\node" -Recurse -Force }
  Move-Item (Join-Path $tmp $name) "$Tools\node"
  Remove-Item $tmp -Recurse -Force
}
function Install-PortableGit {
  $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -UseBasicParsing -Headers @{ 'User-Agent' = 'sakura-panel-installer' }
  $asset = $rel.assets | Where-Object { $_.name -match '^MinGit-[\d.]+-64-bit\.zip$' } | Select-Object -First 1
  if (-not $asset) { throw 'Could not find a portable Git download.' }
  Get-Zip $asset.browser_download_url "$Tools\git"
}

function Install-Requirement([string]$Command, [string]$WingetId, [string]$Name, [scriptblock]$Portable) {
  Add-PathIfExists $KnownDirs[$Command]
  if (Test-Command $Command) { Write-Done "$Name found"; return }

  if (Test-Command 'winget') {
    Write-Step "Installing $Name with winget"
    try { winget install --id $WingetId --exact --source winget --silent --accept-package-agreements --accept-source-agreements | Out-Host } catch { }
    Update-SessionPath
    Add-PathIfExists $KnownDirs[$Command]
    if (Test-Command $Command) { Write-Done "$Name installed"; return }
  }

  Write-Step "Downloading a portable $Name for SAKURA PANEL"
  New-Item -ItemType Directory -Path $Tools -Force | Out-Null
  & $Portable
  Add-PathIfExists $KnownDirs[$Command]
  if (-not (Test-Command $Command)) { throw "$Name could not be installed. Check your internet connection, then run the command again." }
  Write-Done "$Name ready"
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

  Install-Requirement 'git' 'Git.Git' 'Git' { Install-PortableGit }
  Install-Requirement 'node' 'OpenJS.NodeJS.LTS' 'Node.js LTS' { Install-PortableNode }

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
  if (-not (Test-Path $electron)) {
    # npm skipped Electron's postinstall (ignore-scripts, newer npm defaults...): run its downloader directly.
    Write-Step 'Downloading the Electron runtime'
    Remove-Item Env:\ELECTRON_SKIP_BINARY_DOWNLOAD -ErrorAction SilentlyContinue
    $installer = Join-Path $Dir 'node_modules\electron\install.js'
    if (-not (Test-Path $installer)) { throw "The electron package is missing from node_modules. Delete $Dir and run the install command again." }
    Push-Location $Dir
    try { Invoke-Native 'Electron download' { node $installer } } finally { Pop-Location }
  }
  if (-not (Test-Path $electron)) { throw "Electron could not be downloaded ($electron is missing). Check your internet connection or proxy, then run the install command again." }
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
