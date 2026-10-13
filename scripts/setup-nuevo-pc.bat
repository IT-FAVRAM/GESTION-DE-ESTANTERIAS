@echo off
rem Lanza setup-nuevo-pc.ps1 saltandose la politica de ejecucion y deja la ventana abierta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-nuevo-pc.ps1" %*
echo.
pause
