@echo off
setlocal
cd /d "%~dp0"
title Panaderia Lela
echo.
echo  Arrancando Panaderia Lela...
echo  (actualiza desde GitHub, instala si hace falta, reinicia y abre tunel)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-todo.ps1"
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo  Hubo un error ^(codigo %ERR%^). Revisa el mensaje de arriba.
  pause
)
endlocal
exit /b %ERR%
