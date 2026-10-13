@echo off
title WMS Estanterias - Prueba autorrelleno por OF
color 0B

echo.
echo  ==================================================
echo   PRUEBA: autorrelleno de articulo por OF
echo  ==================================================
echo.
echo  Se abriran DOS ventanas:
echo.
echo    1. ERP Bridge  - habla con el ERP (10.0.0.19:8000)
echo    2. Servidor    - la aplicacion web
echo.
echo  Deja las DOS abiertas mientras pruebas.
echo.
echo  Al entrar el navegador avisara del certificado:
echo    "Configuracion avanzada" y luego
echo    "Acceder a localhost (sitio no seguro)"
echo.
echo  Si no aparece ese enlace, haz clic en la pagina
echo  y escribe a ciegas:  thisisunsafe
echo.
echo  --------------------------------------------------
echo   Pruebalo escribiendo SOLO la OF:
echo     OF26-05315  --^>  debe salir Q674837400Q81
echo     OF25-06771  --^>  debe salir 0001401ZS
echo  --------------------------------------------------
echo.
pause

:: Ventana 1 - el bridge (queda abierta con su log en vivo)
start "ERP Bridge" cmd /k "cd /d "%~dp0bridge" && npm start"

:: Ventana 2 - abre el navegador pasados unos segundos
start "" cmd /c "timeout /t 6 /nobreak >nul && start https://localhost:3000"

:: Esta ventana se queda con el servidor de la app
cd /d "%~dp0aplicacion"
npm run dev

pause
