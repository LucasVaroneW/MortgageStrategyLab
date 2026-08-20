@echo off
REM ============================================================
REM  Mortgage Strategy Lab - Modo desarrollo (Node.js)
REM ============================================================
REM  Arranca el servidor con Node.js directamente (sin .exe).
REM  Requiere Node.js instalado.
REM ============================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set PORT=8765

REM Buscar puerto libre.
for /L %%P in (8765,1,8770) do (
  netstat -ano | findstr ":%%P " >nul 2>&1
  if !errorlevel! neq 0 (
    set PORT=%%P
    goto :encontrado
  )
)

:encontrado
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js no encontrado. Instala desde https://nodejs.org
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Mortgage Strategy Lab - Modo desarrollo
echo ============================================================
echo.

REM Arrancar Node minimizado.
start /b /min "MSL-Dev" cmd /c "node server.cjs %PORT% > nul 2>&1"

set /a INTENTOS=0
:esperar
timeout /t 1 /nobreak >nul
set /a INTENTOS+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if !errorlevel! equ 0 goto :abrir
if !INTENTOS! lss 10 goto :esperar

:abrir
echo [OK] Servidor activo en http://localhost:%PORT%/
echo [INFO] Abriendo navegador...
start "" "http://localhost:%PORT%/"

echo.
echo   Para DETENER:  stop.bat
echo.
exit /b 0
