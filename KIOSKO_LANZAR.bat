@echo off
title WMS ESTANTERIAS — Modo Kiosko
color 0B

:: ============================================================
::  WMS CONTROL — LANZADOR DE KIOSKO
::  Ejecuta la app en modo kiosko (pantalla completa, sin barras)
:: ============================================================

:: ------------------------------------------------------------
::  CONFIGURACION — Edita estas lineas segun tu kiosko
:: ------------------------------------------------------------

:: Seccion del kiosko (cambia segun la estanteria)
:: Opciones: PRENSAS, MECANIZADO, REPASADO, SOLDADURA, PINTURA, PLEGADORA, CALIDAD, ZINCADO
set SECCION=PRENSAS

:: URL de la app (deja la linea que necesites, comenta las otras)
:: Produccion (Firebase):
set APP_URL=https://gestion-de-estanterias.web.app/?kiosko=%SECCION%
:: Desarrollo local (descomenta esta y comenta la de produccion):
:: set APP_URL=https://localhost:3000/?kiosko=%SECCION%

:: Navegador: CHROME o EDGE
set NAVEGADOR=CHROME

:: Reiniciar si se cierra (SI/NO)
set REINICIAR=SI

:: Tiempo entre reintentos (segundos)
set ESPERA_REINICIO=5

:: ------------------------------------------------------------
::  FIN CONFIGURACION — No editar debajo de esta linea
:: ------------------------------------------------------------

echo.
echo  ==============================================
echo   WMS ESTANTERIAS — MODO KIOSKO
echo  ==============================================
echo.
echo  Seccion:   %SECCION%
echo  URL:       %APP_URL%
echo  Navegador: %NAVEGADOR%
echo  Reinicio:  %REINICIAR%
echo.
echo  Pulsa Ctrl+C para detener.
echo.

:: Detectar ruta del navegador
set "BROWSER_PATH="

if /I "%NAVEGADOR%"=="CHROME" (
    :: Chrome comun
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        set "BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
    )
    :: Chrome Canary
    if exist "C:\Program Files\Google\Chrome Canary\Application\chrome.exe" (
        set "BROWSER_PATH=C:\Program Files\Google\Chrome Canary\Application\chrome.exe"
    )
    :: Chrome (usuario)
    if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
        set "BROWSER_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
    )
)

if /I "%NAVEGADOR%"=="EDGE" (
    :: Edge comun
    if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
        set "BROWSER_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    )
    :: Edge (usuario)
    if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" (
        set "BROWSER_PATH=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
    )
)

:: Si no encontro el navegador solicitado, buscar cualquiera
if "%BROWSER_PATH%"=="" (
    echo  [!] %NAVEGADOR% no encontrado. Buscando alternativas...
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        set "BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
        echo  [i] Usando Google Chrome
    ) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
        set "BROWSER_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        echo  [i] Usando Microsoft Edge
    ) else (
        echo  [X] No se encontro Chrome ni Edge instalado.
        echo      Instala Chrome o Edge y vuelve a intentar.
        pause
        exit /b 1
    )
)

echo  [OK] Navegador: %BROWSER_PATH%
echo.

:: Carpeta de datos persistente del kiosko (separa sesiones)
set "KIOSK_DATA_DIR=%~dp0kiosko-data"

:: Bucle de reinicio
:LANZAR

echo  [%time%] Abriendo kiosko...

:: Flags de kiosko para Chrome/Edge:
::   --kiosk                 Pantalla completa sin barras
::   --no-first-run          Saltar wizard de primer uso
::   --no-default-browser    No preguntar navegador por defecto
::   --disable-infocubars    Quitar barra de "restaurar sesion"
::   --disable-session-crashed-bubble  No mostrar popup de restaurar
::   --disable-features=TranslateUI  No mostrar traductor
::   --disable-extensions    Sin extensiones
::   --disable-popup-blocking Sin bloqueo de popups
::   --noerrdialogs          No mostrar dialogos de error
::   --start-maximized       Maximizar ventana
::   --incognito             Modo privado (no guarda historial)
::   --user-data-dir         Carpeta de datos separada

start "" "%BROWSER_PATH%" ^
    --kiosk ^
    --no-first-run ^
    --no-default-browser ^
    --disable-infobars ^
    --disable-session-crashed-bubble ^
    --disable-features=TranslateUI ^
    --disable-extensions ^
    --disable-popup-blocking ^
    --noerrdialogs ^
    --start-maximized ^
    --incognito ^
    --user-data-dir="%KIOSK_DATA_DIR%" ^
    "%APP_URL%"

echo  [%time%] Kiosko abierto.
echo.

if /I "%REINICIAR%"=="NO" (
    echo  El navegador se ha abierto. Puedes cerrar esta ventana.
    pause
    exit /b 0
)

:: Esperar a que Chrome/Edge se cierre
echo  Esperando cierre del navegador...
echo  (Si el navegador se cierra, se reiniciara en %ESPERA_REINICIO% segundos)
echo.

:ESPERAR
:: Comprobar si el proceso sigue activo
tasklist /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I "chrome.exe" >NUL
if %ERRORLEVEL%==0 (
    timeout /t 2 /nobreak >NUL
    goto ESPERAR
)

tasklist /FI "IMAGENAME eq msedge.exe" 2>NUL | find /I "msedge.exe" >NUL
if %ERRORLEVEL%==0 (
    timeout /t 2 /nobreak >NUL
    goto ESPERAR
)

echo.
echo  [%time%] Navegador cerrado.
echo  Reiniciando en %ESPERA_REINICIO% segundos...
echo  (Ctrl+C para detener)
echo.
timeout /t %ESPERA_REINICIO% /nobreak
goto LANZAR
