@echo off
REM ============================================================
REM  Mortgage Strategy Lab - Lanzador (doble clic para abrir)
REM ============================================================
REM  Arranca el servidor MortgageStrategyLab.exe SIN ventana
REM  visible (usa PowerShell con WindowStyle Hidden) y abre
REM  el navegador automaticamente.
REM ============================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set EXE=MortgageStrategyLab.exe
set PORT=8765

REM Comprobar si el .exe existe.
if not exist "%EXE%" (
  echo.
  echo [ERROR] No se encontro %EXE%
  echo.
  echo Opciones:
  echo   1. Construye el .exe con:  npm run build:exe
  echo   2. O usa el modo desarrollo con:  start-dev.bat
  echo.
  pause
  exit /b 1
)

REM Buscar puerto libre si 8765 esta ocupado.
for /L %%P in (8765,1,8770) do (
  netstat -ano | findstr ":%%P " >nul 2>&1
  if !errorlevel! neq 0 (
    set PORT=%%P
    goto :arrancar
  )
)

:arrancar
echo.
echo ============================================================
echo   Mortgage Strategy Lab
echo ============================================================
echo.

REM Arrancar el .exe SIN ventana visible usando PowerShell.
REM -WindowStyle Hidden  -> no muestra la ventana de consola
REM -RedirectStandardOutput/-Error -> logs a nul (no aparece nada)
set PS_CMD=Start-Process -FilePath '%~dp0%EXE%' -ArgumentList '%PORT%' -WindowStyle Hidden -RedirectStandardOutput nul -RedirectStandardError nul -PassThru
for /f "tokens=*" %%I in ('powershell -NoProfile -Command "!PS_CMD!"') do set SERVER_PID=%%I

echo [INFO] Servidor arrancado (PID !SERVER_PID!).
echo [INFO] Esperando a que este listo...

REM Esperar a que el servidor responda (max 10s).
set /a INTENTOS=0
:esperar
timeout /t 1 /nobreak >nul
set /a INTENTOS+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if !errorlevel! equ 0 goto :abrir
if !INTENTOS! lss 10 goto :esperar

echo [WARN] El servidor no respondio en 10s. Abriendo navegador igualmente.
goto :abrir

:abrir
echo [OK] Servidor activo en http://localhost:%PORT%/
echo [INFO] Abriendo navegador...
start "" "http://localhost:%PORT%/"

echo.
echo ============================================================
echo   Servidor ejecutandose en segundo plano.
echo   PID: !SERVER_PID!   Puerto: !PORT!
echo.
echo   Para DETENER el servidor, ejecuta:  stop.bat
echo ============================================================
echo.

REM Salir inmediatamente para no dejar terminal visible.
exit /b 0
