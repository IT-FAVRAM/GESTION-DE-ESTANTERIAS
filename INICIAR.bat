@echo off
title WMS Estanterias — Servidor Local
color 0A

echo.
echo  ==============================================
echo   WMS ESTANTERIAS — Iniciando servidor local
echo  ==============================================
echo.
echo  Abriendo en: https://localhost:3000
echo  (Acepta el certificado si el navegador avisa)
echo.
echo  Pulsa Ctrl+C para detener el servidor.
echo.

cd /d "%~dp0APP\frontend"

:: Espera 3 segundos y abre el navegador en segundo plano
start "" cmd /c "timeout /t 3 /nobreak >nul && start https://localhost:3000"

npm run dev

pause
