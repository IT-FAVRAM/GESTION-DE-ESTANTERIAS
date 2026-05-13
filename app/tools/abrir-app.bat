@echo off
setlocal

cd /d "%~dp0..\web"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm no esta disponible en este equipo.
  echo Instala Node.js y vuelve a intentarlo.
  pause
  exit /b 1
)

echo Iniciando la app WMS en modo desarrollo...
start "WMS Dev Server" cmd /k "cd /d \"%~dp0..\web\" && npm run dev -- --host 127.0.0.1 --port 3000"

timeout /t 5 /nobreak >nul
start "" http://127.0.0.1:3000/

echo Si el navegador se abre antes de tiempo, espera unos segundos y recarga.
exit /b 0
