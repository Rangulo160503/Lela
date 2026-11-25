# Restaura la BD desde data\recovery\panaderia-lela-RECOVERY.sqlite
# (copia tomada del menú / servidor que sí tenía los productos).
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$src = Join-Path $Root 'data\recovery\panaderia-lela-RECOVERY.sqlite'
if (-not (Test-Path $src)) {
  Write-Host "No esta $src"
  exit 1
}

# Cerrar servidor si corre
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -and (
      $_.CommandLine -match 'server/src/index' -or
      $_.CommandLine -match 'tsx.*index'
    )
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1

$targets = @(
  (Join-Path $env:LOCALAPPDATA 'PanaderiaLela\data'),
  (Join-Path $Root 'data')
)

foreach ($dir in $targets) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Copy-Item $src (Join-Path $dir 'panaderia-lela.sqlite') -Force
  Remove-Item (Join-Path $dir 'panaderia-lela.sqlite-wal') -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $dir 'panaderia-lela.sqlite-shm') -Force -ErrorAction SilentlyContinue
  Write-Host "Restaurado en $dir"
}

Write-Host ''
Write-Host 'Listo. Ejecuta Iniciar.bat y verifica Catalogo /menu.'
