@echo off
setlocal

cd /d "%~dp0"
title Gestor Estanterias WMS

echo.
echo ==============================================
echo   GESTOR ESTANTERIAS - ARRANQUE RAPIDO
echo ==============================================
echo.
echo Iniciando servidor web en modo desarrollo...
echo Cuando aparezca la URL, abre el navegador en:
echo http://localhost:5173
echo.

npm --prefix app/web run dev

endlocal
