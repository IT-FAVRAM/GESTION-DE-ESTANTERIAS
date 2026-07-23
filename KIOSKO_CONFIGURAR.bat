@echo off
title WMS — Configurar Kiosko
color 0E

echo.
echo  ==============================================
echo   WMS ESTANTERIAS — Configurar Kiosko
echo  ==============================================
echo.
echo  Selecciona la seccion para este kiosko:
echo.
echo   1. PRENSAS       (Estanteria PRE)
echo   2. MECANIZADO    (Estanteria MEC)
echo   3. REPASADO      (Estanteria REP)
echo   4. SOLDADURA     (Estanteria SOL)
echo   5. PINTURA       (Estanteria PIN)
echo   6. PLEGADORA     (Estanteria PLE)
echo   7. CALIDAD       (Estanteria CAL)
echo   8. ZINCADO       (Estanteria ZIN)
echo   9. AUTOPLEGADORA (Estanteria RPL)
echo  10. ROBOT SOLDADURA (Estanteria RSO)
echo.
echo  0. Modo Desarrollo (localhost)
echo.

set /p SECCION="Selecciona una opcion (0-10): "

set URL_PROD=https://gestion-de-estanterias.web.app/
set URL_DEV=https://localhost:3000/

if "%SECCION%"=="0" (
    set APP_URL=%URL_DEV%
    set NOMBRE=Desarrollo
    goto CONFIGURAR
)

if "%SECCION%"=="1" (
    set APP_URL=%URL_PROD%?kiosko=prensas
    set NOMBRE=PRENSAS
    goto CONFIGURAR
)
if "%SECCION%"=="2" (
    set APP_URL=%URL_PROD%?kiosko=mecanizado
    set NOMBRE=MECANIZADO
    goto CONFIGURAR
)
if "%SECCION%"=="3" (
    set APP_URL=%URL_PROD%?setup=REPASADO
    set NOMBRE=REPASADO
    goto CONFIGURAR
)
if "%SECCION%"=="4" (
    set APP_URL=%URL_PROD%?setup=SOLDADURA
    set NOMBRE=SOLDADURA
    goto CONFIGURAR
)
if "%SECCION%"=="5" (
    set APP_URL=%URL_PROD%?setup=PINTURA
    set NOMBRE=PINTURA
    goto CONFIGURAR
)
if "%SECCION%"=="6" (
    set APP_URL=%URL_PROD%?setup=PLEGADORA
    set NOMBRE=PLEGADORA
    goto CONFIGURAR
)
if "%SECCION%"=="7" (
    set APP_URL=%URL_PROD%?setup=CALIDAD
    set NOMBRE=CALIDAD
    goto CONFIGURAR
)
if "%SECCION%"=="8" (
    set APP_URL=%URL_PROD%?setup=ZINCADO
    set NOMBRE=ZINCADO
    goto CONFIGURAR
)
if "%SECCION%"=="9" (
    set APP_URL=%URL_PROD%?setup=AUTOPLEGADORA
    set NOMBRE=AUTOPLEGADORA
    goto CONFIGURAR
)
if "%SECCION%"=="10" (
    set APP_URL=%URL_PROD%?setup=ROBOT_SOLDADURA
    set NOMBRE=ROBOT_SOLDADURA
    goto CONFIGURAR
)

echo.
echo  [X] Opcion no valida.
pause
exit /b 1

:CONFIGURAR
echo.
echo  ==============================================
echo   Configuracion seleccionada:
echo  ==============================================
echo.
echo   Seccion: %NOMBRE%
echo   URL:     %APP_URL%
echo.

:: Actualizar el archivo KIOSKO_LANZAR.bat
set "BAT_FILE=%~dp0KIOSKO_LANZAR.bat"

:: Crear nuevo contenido
(
echo @echo off
echo title WMS ESTANTERIAS — Modo Kiosko — %NOMBRE%
echo color 0B
echo.
echo :: ============================================================
echo ::  WMS CONTROL — LANZADOR DE KIOSKO
echo ::  Seccion configurada: %NOMBRE%
echo :: ============================================================
echo.
echo :: ------------------------------------------------------------
echo ::  CONFIGURACION
echo :: ------------------------------------------------------------
echo set SECCION=%NOMBRE%
echo set APP_URL=%APP_URL%
echo set NAVEGADOR=CHROME
echo set REINICIAR=SI
echo set ESPERA_REINICIO=5
echo.
echo :: ------------------------------------------------------------
echo ::  FIN CONFIGURACION
echo :: ------------------------------------------------------------
echo.
echo echo.
echo echo  ==============================================
echo echo   WMS ESTANTERIAS — MODO KIOSKO
echo echo  ==============================================
echo echo.
echo echo  Seccion:   %%SECCION%%
echo echo  URL:       %%APP_URL%%
echo echo  Navegador: %%NAVEGADOR%%
echo echo  Reinicio:  %%REINICIAR%%
echo echo.
echo echo  Pulsa Ctrl+C para detener.
echo echo.
echo.
echo set "BROWSER_PATH="
echo.
echo if /I "%%NAVEGADOR%%"=="CHROME" ^(
echo     if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
echo     if exist "%%LOCALAPPDATA%%\Google\Chrome\Application\chrome.exe" set "BROWSER_PATH=%%LOCALAPPDATA%%\Google\Chrome\Application\chrome.exe"
echo ^)
echo.
echo if /I "%%NAVEGADOR%%"=="EDGE" ^(
echo     if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
echo     if exist "%%LOCALAPPDATA%%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_PATH=%%LOCALAPPDATA%%\Microsoft\Edge\Application\msedge.exe"
echo ^)
echo.
echo if "%%BROWSER_PATH%%"=="" ^(
echo     if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
echo     if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
echo ^)
echo.
echo if "%%BROWSER_PATH%%"=="" ^(
echo     echo  [X] No se encontro navegador.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo set "KIOSK_DATA_DIR=%%~dp0kiosko-data"
echo.
echo :LANZAR
echo echo  [%%time%%] Abriendo kiosko...
echo start "" "%%BROWSER_PATH%%" --kiosk --no-first-run --no-default-browser --disable-infobars --disable-session-crashed-bubble --disable-features=TranslateUI --disable-extensions --disable-popup-blocking --noerrdialogs --start-maximized --incognito --user-data-dir="%%KIOSK_DATA_DIR%%" "%%APP_URL%%"
echo echo  [%%time%%] Kiosko abierto.
echo.
echo if /I "%%REINICIAR%%"=="NO" ^(
echo     pause
echo     exit /b 0
echo ^)
echo.
echo :ESPERAR
echo tasklist /FI "IMAGENAME eq chrome.exe" 2^>NUL ^| find /I "chrome.exe" ^>NUL
echo if %%ERRORLEVEL%%==0 ^(
echo     timeout /t 2 /nobreak ^>NUL
echo     goto ESPERAR
echo ^)
echo tasklist /FI "IMAGENAME eq msedge.exe" 2^>NUL ^| find /I "msedge.exe" ^>NUL
echo if %%ERRORLEVEL%%==0 ^(
echo     timeout /t 2 /nobreak ^>NUL
echo     goto ESPERAR
echo ^)
echo echo  Reiniciando...
echo timeout /t %%ESPERA_REINICIO%% /nobreak
echo goto LANZAR
) > "%TEMP%\kiosko_temp.bat"

move /Y "%TEMP%\kiosko_temp.bat" "%BAT_FILE%" >NUL

echo  [OK] KIOSKO_LANZAR.bat actualizado con la seccion %NOMBRE%.
echo.
echo  Ahora ejecuta KIOSKO_LANZAR.bat para iniciar el kiosko.
echo.
pause
