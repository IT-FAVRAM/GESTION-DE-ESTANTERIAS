@echo off
title WMS ESTANTERIAS — Kiosko SOLDADURA
color 0E

:: ============================================================
::  WMS CONTROL — LANZADOR DEL KIOSKO DE SOLDADURA
::  Abre la app en pantalla completa con la configuracion de
::  SOLDADURA (setup), igual que KIOSKO_CONFIGURAR.bat opcion 4.
::  Usa su propia carpeta de datos (kiosko-data-soldadura).
:: ============================================================

set APP_URL=https://gestion-de-estanterias.web.app/?setup=SOLDADURA

echo.
echo  ==============================================
echo   WMS ESTANTERIAS — KIOSKO SOLDADURA
echo  ==============================================
echo.
echo  URL: %APP_URL%
echo.

set "BROWSER_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if "%BROWSER_PATH%"=="" if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if "%BROWSER_PATH%"=="" if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_PATH=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if "%BROWSER_PATH%"=="" (
    echo  [X] No se encontro Chrome ni Edge instalado.
    pause
    exit /b 1
)

echo  [OK] Navegador: %BROWSER_PATH%
echo  Pulsa Ctrl+C para cerrar este lanzador. El navegador se cierra con Alt+F4.
echo.

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
    --user-data-dir="%~dp0kiosko-data-soldadura" ^
    "%APP_URL%"

echo  [%time%] Kiosko de SOLDADURA abierto.
timeout /t 5 >NUL
exit /b 0
