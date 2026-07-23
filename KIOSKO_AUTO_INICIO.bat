@echo off
title WMS — Auto-Inicio Kiosko
color 0D

echo.
echo  ==============================================
echo   WMS ESTANTERIAS — Configurar Auto-Inicio
echo  ==============================================
echo.
echo  Esto configura Windows para que el kiosko
echo  se inicie automaticamente al encender el PC.
echo.
echo  REQUISITOS:
echo   - Ejecutar como Administrador
echo   - Tener configurado KIOSKO_LANZAR.bat
echo.

:: Verificar si es administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [X] Se requieren permisos de Administrador.
    echo      Haz clic derecho ^> "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

echo  [OK] Permisos de administrador verificados.
echo.

set "SCRIPT_PATH=%~dp0KIOSKO_LANZAR.bat"
set "TASK_NAME=WMS_Kiosko_AutoStart"

:: Preguntar accion
echo  Selecciona una opcion:
echo.
echo   1. Activar auto-inicio (iniciar con Windows)
echo   2. Desactivar auto-inicio
echo   3. Probar el kiosko ahora
echo.
set /p OPCION="Opcion (1-3): "

if "%OPCION%"=="1" goto ACTIVAR
if "%OPCION%"=="2" goto DESACTIVAR
if "%OPCION%"=="3" goto PROBAR
echo  [X] Opcion no valida
pause
exit /b 1

:ACTIVAR
echo.
echo  Creando tarea de auto-inicio...

:: Eliminar tarea existente
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: Crear tarea para iniciar al logon
schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if %errorLevel%==0 (
    echo.
    echo  [OK] Auto-inicio ACTIVADO.
    echo      El kiosko se iniciara cada vez que inicie sesion Windows.
    echo.
    echo  NOTA: Para que sea truly automatico, configura Windows
    echo  para iniciar sesion automaticamente:
    echo    - Win+R ^> netplwiz ^> Desmarcar "requiere contraseña"
    echo    - Seleccionar usuario ^> Propiedades ^> Auto-login
) else (
    echo.
    echo  [X] Error al crear la tarea.
)
echo.
pause
exit /b 0

:DESACTIVAR
echo.
echo  Eliminando tarea de auto-inicio...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

if %errorLevel%==0 (
    echo  [OK] Auto-inicio DESACTIVADO.
) else (
    echo  [i] No habia tarea de auto-inicio configurada.
)
echo.
pause
exit /b 0

:PROBAR
echo.
echo  Iniciando kiosko de prueba...
start "" "%SCRIPT_PATH%"
echo  [OK] Kiosko iniciado.
echo.
pause
exit /b 0
