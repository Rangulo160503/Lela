$ErrorActionPreference = 'SilentlyContinue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and (
      $_.CommandLine -match 'cloudflared' -or
      $_.CommandLine -match 'trycloudflare' -or
      $_.CommandLine -match 'server/src/index' -or
      $_.CommandLine -match 'tsx.*index'
    )
  } |
  ForEach-Object {
    Write-Host ("  stop PID " + $_.ProcessId)
    Stop-Process -Id $_.ProcessId -Force
  }

Get-NetTCPConnection -LocalPort 3000 -State Listen |
  ForEach-Object {
    Write-Host ("  stop port 3000 PID " + $_.OwningProcess)
    Stop-Process -Id $_.OwningProcess -Force
  }

Remove-Item -Force (Join-Path $Root 'tunel.pid'), (Join-Path $Root 'tunel-log.txt') -ErrorAction SilentlyContinue
Write-Host '  stopped'
