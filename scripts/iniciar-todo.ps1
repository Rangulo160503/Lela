# Inicia / reinicia Panaderia Lela:
#  - instala Git/Node si faltan
#  - git pull desde GitHub (preserva data/)
#  - npm install (sin node-gyp; usa prebuilds) + build
#  - servidor :3000 + tunel Cloudflare
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

$RepoUrl = 'https://github.com/Rangulo160503/Lela.git'
$Branch = 'main'
$PortableNodeVer = 'v22.23.5'
$MinNodeVer = [version]'22.22.0'

$urlFile = Join-Path $Root 'tunel-url.txt'
$logFile = Join-Path $Root 'tunel-log.txt'
$pidFile = Join-Path $Root 'tunel.pid'
$runtimeDir = Join-Path $Root 'runtime'
$nodeExe = Join-Path $runtimeDir 'node.exe'
$npmCmd = Join-Path $runtimeDir 'npm.cmd'
$minGitDir = Join-Path $runtimeDir 'mingit'

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

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$GitArgs)
  # Evita que stderr de git (hints / "No such remote") tumbe el script con Stop
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & git @GitArgs 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  foreach ($line in $output) {
    $text = "$line"
    if (-not $text) { continue }
    if ($text -match '^(hint|warning):') { continue }
    Write-Host ("  git: " + $text)
  }
  return $code
}

function Get-NodeVersionObject([string]$VersionText) {
  if ($VersionText -match 'v?(\d+)\.(\d+)\.(\d+)') {
    return [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
  }
  return [version]'0.0.0'
}

function Ensure-Git {
  $sysGit = Get-Command git -ErrorAction SilentlyContinue
  if ($sysGit) {
    Write-Host ('  Git del sistema: ' + (& git --version))
    return
  }

  $portableGit = Join-Path $minGitDir 'cmd\git.exe'
  if (Test-Path $portableGit) {
    $env:Path = "$(Join-Path $minGitDir 'cmd');$(Join-Path $minGitDir 'mingw64\bin');$env:Path"
    Write-Host ('  Git portable: ' + (& git --version))
    return
  }

  Write-Host '  Descargando MinGit portable (solo la primera vez)...'
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $zipUrl = 'https://github.com/git-for-windows/git/releases/download/v2.56.1.windows.1/MinGit-2.56.1-64-bit.zip'
  $zipPath = Join-Path $env:TEMP 'MinGit-2.56.1-64-bit.zip'
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  if (Test-Path $minGitDir) { Remove-Item $minGitDir -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $minGitDir -Force
  if (-not (Test-Path $portableGit)) {
    $inner = Get-ChildItem $minGitDir -Directory | Select-Object -First 1
    if ($inner -and (Test-Path (Join-Path $inner.FullName 'cmd\git.exe'))) {
      $tmp = Join-Path $runtimeDir 'mingit-tmp'
      if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
      Move-Item $inner.FullName $tmp
      Remove-Item $minGitDir -Recurse -Force -ErrorAction SilentlyContinue
      Move-Item $tmp $minGitDir
    }
  }
  if (-not (Test-Path (Join-Path $minGitDir 'cmd\git.exe'))) {
    throw 'No se pudo instalar Git portable (MinGit).'
  }
  $env:Path = "$(Join-Path $minGitDir 'cmd');$(Join-Path $minGitDir 'mingw64\bin');$env:Path"
  Write-Host ('  Git portable listo: ' + (& git --version))
}

function Ensure-GitRemote {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $remotes = @(& git remote 2>$null)
  $ErrorActionPreference = $prev
  if ($remotes -contains 'origin') {
    $null = Invoke-Git @('remote', 'set-url', 'origin', $RepoUrl)
  } else {
    $code = Invoke-Git @('remote', 'add', 'origin', $RepoUrl)
    if ($code -ne 0) { throw 'No se pudo agregar remote origin.' }
  }
}

function Backup-LelaDataSafety {
  # Copia de seguridad fuera del repo (sobrevive a limpiezas / ZIP nuevos)
  $safetyRoot = Join-Path $env:LOCALAPPDATA 'PanaderiaLela\safety'
  New-Item -ItemType Directory -Force -Path $safetyRoot | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $targets = @(
    (Join-Path $Root 'data'),
    (Join-Path $env:LOCALAPPDATA 'PanaderiaLela\data')
  )
  foreach ($src in $targets) {
    $db = Join-Path $src 'panaderia-lela.sqlite'
    if (-not (Test-Path $db)) { continue }
    $destDir = Join-Path $safetyRoot $stamp
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item $db (Join-Path $destDir 'panaderia-lela.sqlite') -Force
    foreach ($side in @('panaderia-lela.sqlite-wal', 'panaderia-lela.sqlite-shm')) {
      $sidePath = Join-Path $src $side
      if (Test-Path $sidePath) {
        Copy-Item $sidePath (Join-Path $destDir $side) -Force -ErrorAction SilentlyContinue
      }
    }
    $uploads = Join-Path $src 'uploads'
    if (Test-Path $uploads) {
      Copy-Item $uploads (Join-Path $destDir 'uploads') -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host ("  Respaldo de seguridad: $destDir")
    break
  }
}

function Update-FromGitHub {
  $env:GIT_TERMINAL_PROMPT = '0'
  Write-Host '  Actualizando codigo desde GitHub...'

  Backup-LelaDataSafety

  Push-Location $Root
  try {
    if (-not (Test-Path (Join-Path $Root '.git'))) {
      Write-Host '  Carpeta sin git: vinculando con el repo...'
      $code = Invoke-Git @('init', '-b', $Branch)
      if ($code -ne 0) { throw 'git init fallo.' }
    }

    Ensure-GitRemote

    $code = Invoke-Git @('fetch', '--prune', 'origin', $Branch)
    if ($code -ne 0) {
      throw 'git fetch fallo (revisa Internet / acceso a GitHub).'
    }

    # ZIP / carpeta suelta: untracked bloquean checkout.
    # NUNCA borrar data/ ni runtime/ ni .git — ahi viven ventas y catálogo.
    Write-Host '  Preparando checkout (preserva data/ y runtime/)...'
    Get-ChildItem -LiteralPath $Root -Force | Where-Object {
      $_.Name -notin @('.git', 'runtime', 'data')
    } | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }

    $code = Invoke-Git @('checkout', '-f', '-B', $Branch, "origin/$Branch")
    if ($code -ne 0) { throw 'git checkout fallo.' }

    $code = Invoke-Git @('reset', '--hard', "origin/$Branch")
    if ($code -ne 0) { throw 'git reset --hard fallo.' }

    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $head = (& git rev-parse --short HEAD 2>$null)
    $ErrorActionPreference = $prev
    Write-Host ("  Codigo actualizado: $head (origin/$Branch)")
    Write-Host '  Carpeta data/ intacta (no se toca en el update).'
  } finally {
    Pop-Location
  }
}

function Install-PortableNode {
  Write-Host ("  Descargando Node.js portable $PortableNodeVer...")
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $ver = $PortableNodeVer
  $zipUrl = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"
  $zipPath = Join-Path $env:TEMP "node-$ver-win-x64.zip"
  $extract = Join-Path $env:TEMP "node-$ver-win-x64"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force
  Copy-Item (Join-Path $extract 'node.exe') $nodeExe -Force
  Copy-Item (Join-Path $extract 'npm.cmd') $npmCmd -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $extract 'npx.cmd') (Join-Path $runtimeDir 'npx.cmd') -Force -ErrorAction SilentlyContinue
  $runtimeNpmModules = Join-Path $runtimeDir 'node_modules'
  if (Test-Path $runtimeNpmModules) { Remove-Item $runtimeNpmModules -Recurse -Force -ErrorAction SilentlyContinue }
  Copy-Item (Join-Path $extract 'node_modules') $runtimeNpmModules -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host ('  Node portable listo: ' + (& $nodeExe -v))
  $env:Path = "$runtimeDir;$env:Path"
}

function Ensure-Node {
  $sysNode = Get-Command node -ErrorAction SilentlyContinue
  if ($sysNode) {
    $sysVer = Get-NodeVersionObject (& node -v)
    if ($sysVer -ge $MinNodeVer) {
      Write-Host ('  Node del sistema: ' + (& node -v))
      return @{ Mode = 'system' }
    }
    Write-Host ("  Node del sistema ($sysVer) es viejo; se usara portable >= $MinNodeVer")
  }

  if (Test-Path $nodeExe) {
    $portVer = Get-NodeVersionObject (& $nodeExe -v)
    if ($portVer -ge $MinNodeVer) {
      Write-Host ('  Node portable: ' + (& $nodeExe -v))
      $env:Path = "$runtimeDir;$env:Path"
      return @{ Mode = 'portable' }
    }
    Write-Host ("  Node portable ($portVer) es viejo; actualizando...")
  }

  Install-PortableNode
  return @{ Mode = 'portable' }
}

function Resolve-NpmCmd {
  # Preferir npm del Node del sistema (Program Files). El portable solo si no hay otro.
  # No usar cmd /c '"npm.cmd" ...' — esas comillas hacen que %~dp0 sea el cwd del
  # proyecto y npm busque EB\node_modules\npm (MODULE_NOT_FOUND).
  $sys = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($sys -and $sys.Source -and (Test-Path $sys.Source)) {
    return $sys.Source
  }
  if (Test-Path $npmCmd) { return $npmCmd }
  return 'npm.cmd'
}

function Invoke-Npm {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$NpmArguments
  )
  $exe = Resolve-NpmCmd
  Write-Host ("  > npm " + ($NpmArguments -join ' '))
  Write-Host ("  (usando $exe)")
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $exe @NpmArguments
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) {
    throw "npm fallo: $($NpmArguments -join ' ')"
  }
}

function Install-Dependencies {
  # better-sqlite3 v13 trae prebuilds; npm 10 en Windows aun intenta node-gyp
  # si ve binding.gyp. --ignore-scripts evita Python/VS Build Tools.
  $nm = Join-Path $Root 'node_modules'
  $sqlitePre = Join-Path $nm 'better-sqlite3\prebuilds\win32-x64.node'
  $tsxOk = Join-Path $nm 'tsx\dist\cli.mjs'
  $esbuildWin = Join-Path $nm '@esbuild\win32-x64\esbuild.exe'

  $needsClean = $false
  if ((Test-Path $nm) -and (-not (Test-Path $sqlitePre) -or -not (Test-Path $tsxOk))) {
    $needsClean = $true
  }
  if ($needsClean) {
    Write-Host '  Limpiando node_modules incompleto (instalacion previa fallida)...'
    Remove-Item $nm -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host '  npm install --ignore-scripts (usa binarios precompilados)...'
  Invoke-Npm -NpmArguments @('install', '--ignore-scripts')

  if (-not (Test-Path $sqlitePre)) {
    throw 'Falta prebuild better-sqlite3 (win32-x64). Revisa Internet / antivirus.'
  }

  # esbuild: el optional @esbuild/win32-x64 basta; si no, corre install.js
  if (-not (Test-Path $esbuildWin)) {
    $esbuildInstall = Join-Path $nm 'esbuild\install.js'
    if (Test-Path $esbuildInstall) {
      Write-Host '  Completando binario esbuild...'
      if (Test-Path $nodeExe) {
        & $nodeExe $esbuildInstall
      } else {
        & node $esbuildInstall
      }
    }
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

Write-Host '  2) Comprobando Git...'
Ensure-Git

Write-Host '  3) Pull desde GitHub (preserva data/)...'
try {
  Update-FromGitHub
} catch {
  Write-Host ('  AVISO: no se pudo actualizar: ' + $_.Exception.Message)
  Write-Host '  Se continua con la version local.'
}

Write-Host '  4) Comprobando Node.js...'
$null = Ensure-Node

Write-Host '  5) Dependencias...'
Install-Dependencies

Write-Host '  5b) Datos empaquetados (si la BD local esta vacia o incompleta)...'
try {
  $ensureJs = Join-Path $Root 'scripts\ensure-bundled-data.mjs'
  if (Test-Path $ensureJs) {
    if (Test-Path $nodeExe) {
      & $nodeExe $ensureJs
    } else {
      & node $ensureJs
    }
  }
} catch {
  Write-Host ('  AVISO: no se pudo restaurar bundle: ' + $_.Exception.Message)
}

Write-Host '  6) UI React (build)...'
Invoke-Npm -NpmArguments @('run', 'build:web')

if (-not (Test-Path (Join-Path $Root 'lite\index.html'))) {
  Write-Host '  AVISO: falta lite/ (iPad 4 usara React; puede fallar en iOS 9).'
}

$serverLog = Join-Path $Root 'server-log.txt'
$serverErr = Join-Path $Root 'server-err.txt'
Remove-Item $serverLog, $serverErr -Force -ErrorAction SilentlyContinue

Write-Host '  7) Servidor en http://127.0.0.1:3000 ...'
# Rutas con espacios (ej. "Hp 600 G1"): Start-Process no cita ArgumentList solo;
# hay que pasar UNA cadena con comillas embebidas.
if (Test-Path $nodeExe) {
  $tsx = Join-Path $Root 'node_modules\tsx\dist\cli.mjs'
  if (-not (Test-Path $tsx)) { throw "Falta tsx: $tsx" }
  $serverArgs = "`"$tsx`" `"server/src/index.ts`""
  $server = Start-Process -FilePath $nodeExe -ArgumentList $serverArgs `
    -WorkingDirectory $Root -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr
} else {
  $server = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run start' `
    -WorkingDirectory $Root -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr
}

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if ($server.HasExited) {
    Write-Host ('  ERROR: el servidor salio (codigo ' + $server.ExitCode + ').')
    Write-Host '  --- server-err.txt ---'
    if (Test-Path $serverErr) { Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 40 | ForEach-Object { Write-Host $_ } }
    Write-Host '  --- server-log.txt ---'
    if (Test-Path $serverLog) { Get-Content $serverLog -ErrorAction SilentlyContinue | Select-Object -Last 40 | ForEach-Object { Write-Host $_ } }
    exit 1
  }
  if (($i % 5) -eq 0) {
    Write-Host ("  esperando respuesta en :3000 ... {0}s" -f $i)
  }
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}
if (-not $ready) {
  Write-Host '  ERROR: el servidor no respondio en :3000'
  Write-Host '  Mira server-log.txt / server-err.txt'
  if (Test-Path $serverErr) { Get-Content $serverErr -ErrorAction SilentlyContinue | Select-Object -Last 30 | ForEach-Object { Write-Host $_ } }
  exit 1
}
Write-Host '  Servidor OK'

Write-Host '  8) Tunel publico (URL nueva cada vez)...'
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

# iPad / iOS 9 NO abre trycloudflare (certificado). Usar Wi-Fi local HTTP.
$lanIps = @()
try {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.PrefixOrigin -ne 'WellKnown' -and
      $_.IPAddress -notlike '169.254.*'
    } |
    ForEach-Object { $lanIps += $_.IPAddress }
} catch { }
if (-not $lanIps.Count) {
  try {
    $lanIps = @(
      Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $_.IPEnabled -and $_.IPAddress } |
        ForEach-Object { $_.IPAddress } |
        Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and $_ -notlike '127.*' -and $_ -notlike '169.254.*' }
    )
  } catch { }
}
$lanIps = @($lanIps | Select-Object -Unique)
$ipadFile = Join-Path $Root 'ipad-url.txt'
$ipadLines = @()
$ipadLines += 'iPad / iOS 9 — NO uses el link trycloudflare (no abre).'
$ipadLines += 'Misma Wi-Fi que esta PC. En Safari del iPad abrí:'
$ipadLines += ''
foreach ($ip in $lanIps) {
  $ipadLines += ("http://{0}:3000/" -f $ip)
}
if (-not $lanIps.Count) {
  $ipadLines += 'http://IP-DE-ESTA-PC:3000/'
}
$ipadLines += ''
$ipadLines += 'Tunel (celulares modernos / menú clientes):'
$ipadLines += $url
Set-Content -Path $ipadFile -Value ($ipadLines -join "`r`n") -Encoding ascii

Write-Host ''
Write-Host '  LISTO'
Write-Host "  Esta PC:     http://127.0.0.1:3000"
if ($lanIps.Count) {
  Write-Host '  ========================================'
  Write-Host '   iPad / tablet (Wi-Fi local, OBLIGATORIO)'
  Write-Host '  ========================================'
  foreach ($ip in $lanIps) {
    Write-Host ("   http://{0}:3000/" -f $ip)
  }
  Write-Host '  (tambien en ipad-url.txt)'
} else {
  Write-Host '  Red local:   http://IP-DE-ESTA-PC:3000  (mira ipad-url.txt)'
}
Write-Host "  Internet:    $url"
Write-Host '  (tunel-url.txt — NO sirve en iPad viejo / iOS 9)'
Write-Host ''
Write-Host '  Usuarios: admin/1234  ·  empleado/0000'
Write-Host '  Deja esta ventana abierta. Para apagar: Detener.bat'
Write-Host ''

# Abrir LAN en la PC; el tunel es secundario (celulares / menu)
$lanOpen = if ($lanIps.Count) { "http://$($lanIps[0]):3000/" } else { 'http://127.0.0.1:3000/' }
$null = Open-Browser $lanOpen
Start-Sleep -Seconds 1
$null = Open-Browser $url

while (-not $tunnel.HasExited) {
  Start-Sleep -Seconds 5
}
Write-Host '  Tunel cerrado.'
