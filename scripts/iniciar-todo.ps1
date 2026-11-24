# Inicia / reinicia Panaderia Lela: deps, UI, servidor :3000 + tunel Cloudflare.
# Pensado para PC limpia (zip de GitHub) o portable con runtime\.
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

$urlFile = Join-Path $Root 'tunel-url.txt'
$logFile = Join-Path $Root 'tunel-log.txt'
$pidFile = Join-Path $Root 'tunel.pid'
$runtimeDir = Join-Path $Root 'runtime'
$nodeExe = Join-Path $runtimeDir 'node.exe'
$npmCmd = Join-Path $runtimeDir 'npm.cmd'

function Stop-LelaAll {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -match 'cloudflared' -or
        $_.CommandLine -match 'trycloudflare' -or
        $_.CommandLine -match 'server/src/index' -or
        $_.CommandLine -match 'tsx.*index'
      )
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

function Ensure-Node {
  $sysNode = Get-Command node -ErrorAction SilentlyContinue
  if ($sysNode) {
    Write-Host ('  Node del sistema: ' + (& node -v))
    return @{ Mode = 'system' }
  }
  if (Test-Path $nodeExe) {
    Write-Host ('  Node portable: ' + (& $nodeExe -v))
    $env:Path = "$runtimeDir;$env:Path"
    return @{ Mode = 'portable' }
  }

  Write-Host '  Descargando Node.js portable (solo la primera vez)...'
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $ver = 'v22.14.0'
  $zipUrl = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"
  $zipPath = Join-Path $env:TEMP "node-$ver-win-x64.zip"
  $extract = Join-Path $env:TEMP "node-$ver-win-x64"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force
  Copy-Item (Join-Path $extract 'node.exe') $nodeExe -Force
  # npm/npx viven junto al zip de Node
  Copy-Item (Join-Path $extract 'npm.cmd') $npmCmd -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $extract 'npx.cmd') (Join-Path $runtimeDir 'npx.cmd') -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $extract 'node_modules') (Join-Path $runtimeDir 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host ('  Node portable listo: ' + (& $nodeExe -v))
  $env:Path = "$runtimeDir;$env:Path"
  return @{ Mode = 'portable' }
}

function Invoke-Npm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArgs)
  if (Test-Path $npmCmd) {
    & $npmCmd @NpmArgs
  } else {
    & npm.cmd @NpmArgs
  }
  if ($LASTEXITCODE -ne 0) {
    throw "npm fallo: $($NpmArgs -join ' ')"
  }
}

function Open-Browser([string]$targetUrl) {
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $probe = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 5
      if ($probe.StatusCode -ge 200 -and $probe.StatusCode -lt 500) { break }
    } catch { }
    Start-Sleep -Seconds 1
  }
  try { Start-Process $targetUrl; return $true } catch { }
  try { cmd.exe /c "start `"`" `"$targetUrl`""; return $true } catch { }
  return $false
}

Write-Host ''
Write-Host '  ========================================'
Write-Host '   Panaderia Lela'
Write-Host '  ========================================'
Write-Host ''

New-Item -ItemType Directory -Force -Path (Join-Path $Root 'data\backups') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root 'data\uploads') | Out-Null

Write-Host '  1) Cerrando instancias anteriores...'
Stop-LelaAll
Start-Sleep -Seconds 1

Write-Host '  2) Comprobando Node.js...'
$null = Ensure-Node

Write-Host '  3) Dependencias (npm install si hace falta)...'
if (-not (Test-Path (Join-Path $Root 'node_modules\tsx\dist\cli.mjs'))) {
  Invoke-Npm 'install'
} else {
  Write-Host '  node_modules OK'
}

Write-Host '  4) UI React (dist)...'
if (-not (Test-Path (Join-Path $Root 'dist\index.html'))) {
  Invoke-Npm 'run', 'build:web'
} else {
  Write-Host '  dist OK'
}

if (-not (Test-Path (Join-Path $Root 'lite\index.html'))) {
  Write-Host '  AVISO: falta lite/ (iPad 4 usara React; puede fallar en iOS 9).'
}

Write-Host '  5) Servidor en http://127.0.0.1:3000 ...'
if (Test-Path $nodeExe) {
  $tsx = Join-Path $Root 'node_modules\tsx\dist\cli.mjs'
  $server = Start-Process -FilePath $nodeExe -ArgumentList $tsx, 'server/src/index.ts' `
    -WorkingDirectory $Root -PassThru -WindowStyle Minimized
} else {
  $server = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start' `
    -WorkingDirectory $Root -PassThru -WindowStyle Minimized
}

$ready = $false
for ($i = 0; $i -lt 50; $i++) {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 1
}
if (-not $ready) {
  Write-Host '  ERROR: el servidor no respondio en :3000'
  exit 1
}
Write-Host '  Servidor OK'

Write-Host '  6) Tunel publico (URL nueva cada vez)...'
Remove-Item $logFile, $urlFile -Force -ErrorAction SilentlyContinue
$tunnelCmd = "npx --yes cloudflared tunnel --url http://127.0.0.1:3000 > `"$logFile`" 2>&1"
$tunnel = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $tunnelCmd `
  -WorkingDirectory $Root -PassThru -WindowStyle Minimized
"$($server.Id),$($tunnel.Id)" | Set-Content -Path $pidFile -Encoding ascii

$url = $null
for ($i = 0; $i -lt 120; $i++) {
  if (Test-Path $logFile) {
    $text = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
    if ($text -and $text -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
      $url = $Matches[0]
      break
    }
  }
  if ($tunnel.HasExited) { break }
  Start-Sleep -Seconds 1
}

if (-not $url) {
  Write-Host '  ERROR: no se obtuvo URL del tunel. Mira tunel-log.txt'
  Write-Host '  Local sigue en http://127.0.0.1:3000'
  exit 1
}

Set-Content -Path $urlFile -Value $url -Encoding ascii
Write-Host ''
Write-Host '  LISTO'
Write-Host "  Esta PC:     http://127.0.0.1:3000"
Write-Host "  Red local:   http://IP-DE-ESTA-PC:3000"
Write-Host "  Internet:    $url"
Write-Host '  (tambien en tunel-url.txt)'
Write-Host ''
Write-Host '  Usuarios: admin/1234  ·  empleado/0000'
Write-Host '  Deja esta ventana abierta. Para apagar: Detener.bat'
Write-Host ''

$null = Open-Browser $url

while (-not $tunnel.HasExited) {
  Start-Sleep -Seconds 5
}
Write-Host '  Tunel cerrado.'
