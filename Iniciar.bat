@echo off
setlocal
cd /d "%~dp0"

if not exist "data" mkdir "data"
if not exist "data\backups" mkdir "data\backups"
if not exist "data\uploads" mkdir "data\uploads"

set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

set "TSX_CLI=%~dp0node_modules\tsx\dist\cli.mjs"
if not exist "%TSX_CLI%" (
  echo.
  echo  ERROR: faltan archivos del sistema ^(node_modules^).
  echo  Use el ZIP completo Panaderia-Lela.zip.
  echo.
  pause
  exit /b 1
)

echo.
echo  ========================================
echo   Panaderia Lela - Servidor local
echo  ========================================
echo.
echo  Deje esta ventana ABIERTA mientras trabaja.
echo  Para cerrar: Detener.bat o cierre esta ventana.
echo.
echo  En esta PC:     http://127.0.0.1:3000
echo  Otros equipos:  http://IP-DE-ESTA-PC:3000
echo.
echo  Usuarios iniciales:
echo    admin / 1234
echo    empleado / 0000
echo.

"%NODE_EXE%" "%TSX_CLI%" server/src/index.ts
set "ERR=%ERRORLEVEL%"
echo.
echo  Servidor detenido (codigo %ERR%).
pause
endlocal
