@echo off
title WMS — Detener Kiosko
color 0C

echo.
echo  ==============================================
echo   WMS ESTANTERIAS — Detener todos los kioskos
echo  ==============================================
echo.

echo  Cerrando Chrome...
taskkill /F /IM chrome.exe /T 2>NUL

echo  Cerrando Edge...
taskkill /F /IM msedge.exe /T 2>NUL

echo.
echo  [OK] Todos los navegadores kiosko han sido cerrados.
echo.
pause
