@echo off
setlocal
cd /d "%~dp0"
title Panaderia Lela - Detener
echo.
echo  Apagando Panaderia Lela (servidor + tunel)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-lela.ps1"
echo.
echo  Listo. Ya puedes cerrar esta ventana.
pause
endlocal
