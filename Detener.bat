@echo off
setlocal
echo.
echo  Cerrando procesos de Panaderia Lela en el puerto 3000...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo  Terminando PID %%a
  taskkill /PID %%a /F >nul 2>&1
)

echo  Listo. Puedes cerrar esta ventana.
pause
endlocal
