$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "== Build frontend =="
npm.cmd run build

Write-Host "== Ensure runtime Node =="
$runtimeDir = Join-Path $Root "runtime"
$nodeExe = Join-Path $runtimeDir "node.exe"
if (-not (Test-Path $nodeExe)) {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $zipUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
  $zipPath = Join-Path $env:TEMP "node-v22.14.0-win-x64.zip"
  Write-Host "Descargando Node portable (solo en el PC de empaquetado)..."
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  $extract = Join-Path $env:TEMP "node-v22.14.0-win-x64"
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force
  Copy-Item (Join-Path $extract "node.exe") $nodeExe -Force
}

Write-Host "== Staging portable folder =="
$stage = Join-Path $Root "portable-stage\Panaderia-Lela"
if (Test-Path (Join-Path $Root "portable-stage")) {
  Remove-Item (Join-Path $Root "portable-stage") -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stage | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stage "data\backups") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stage "data\uploads") | Out-Null

$copy = @(
  "dist",
  "server",
  "runtime",
  "node_modules",
  "package.json",
  "package-lock.json",
  "Iniciar.bat",
  "Detener.bat",
  "LEEME.txt",
  "README.md",
  "INFORME-MVP.md"
)
foreach ($item in $copy) {
  $src = Join-Path $Root $item
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $stage $item) -Recurse -Force
  }
}

# Seed empty data marker (DB se crea al iniciar)
Set-Content -Path (Join-Path $stage "data\.keep") -Value ""

Write-Host "== ZIP =="
$zipOut = Join-Path $Root "Panaderia-Lela.zip"
if (Test-Path $zipOut) { Remove-Item $zipOut -Force }
Compress-Archive -Path $stage -DestinationPath $zipOut -Force
Write-Host "OK: $zipOut"
