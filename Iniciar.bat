@echo off
setlocal
cd /d "%~dp0"
title Panaderia Lela
echo.
echo  Arrancando Panaderia Lela...
echo  (actualiza desde GitHub, instala si hace falta, reinicia y abre tunel)
echo.

REM Refresca el script de arranque desde GitHub (por si la copia local esta vieja/rota)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $u='https://raw.githubusercontent.com/Rangulo160503/Lela/main/scripts/iniciar-todo.ps1'; $o='%~dp0scripts\iniciar-todo.ps1'; New-Item -ItemType Directory -Force -Path (Split-Path $o) | Out-Null; Invoke-WebRequest -Uri $u -OutFile $o -UseBasicParsing } catch { Write-Host '  (no se pudo refrescar script; se usa el local)' }"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-todo.ps1"
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo  Hubo un error ^(codigo %ERR%^). Revisa el mensaje de arriba.
  pause
)
endlocal
exit /b %ERR%
