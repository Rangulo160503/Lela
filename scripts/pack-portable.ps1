$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "== Build frontend =="
npm.cmd run build:web
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== Ensure runtime Node =="
$runtimeDir = Join-Path $Root "runtime"
$nodeExe = Join-Path $runtimeDir "node.exe"
if (-not (Test-Path $nodeExe)) {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $ver = "v22.14.0"
  $zipUrl = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"
  $zipPath = Join-Path $env:TEMP "node-$ver-win-x64.zip"
  Write-Host "Descargando Node portable..."
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  $extract = Join-Path $env:TEMP "node-$ver-win-x64"
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force
  Copy-Item (Join-Path $extract "node.exe") $nodeExe -Force
  Copy-Item (Join-Path $extract "npm.cmd") (Join-Path $runtimeDir "npm.cmd") -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $extract "npx.cmd") (Join-Path $runtimeDir "npx.cmd") -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $extract "node_modules") (Join-Path $runtimeDir "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
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
  "lite",
  "dist",
  "public",
  "server",
  "scripts",
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

Set-Content -Path (Join-Path $stage "data\.keep") -Value ""

Write-Host "== ZIP =="
$zipOut = Join-Path $Root "Panaderia-Lela.zip"
if (Test-Path $zipOut) { Remove-Item $zipOut -Force }
Compress-Archive -Path $stage -DestinationPath $zipOut -Force
Write-Host "OK: $zipOut"
