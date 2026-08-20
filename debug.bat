@echo off
REM ============================================================
REM  Mortgage Strategy Lab - Ver logs del servidor (debug)
REM ============================================================
REM  Arranca el servidor EN PRIMER PLANO mostrando todos los logs.
REM  Para salir: Ctrl+C
REM ============================================================

setlocal
set PORT=8765
cd /d "%~dp0"

echo.
echo ============================================================
echo   Mortgage Strategy Lab - Modo DEBUG
echo   Logs en tiempo real. Ctrl+C para detener.
echo ============================================================
echo.

where node >nul 2>&1
if %errorlevel% equ 0 (
  node server.cjs %PORT%
  goto :fin
)
where python >nul 2>&1
if %errorlevel% equ 0 (
  python -m http.server %PORT%
  goto :fin
)
where py >nul 2>&1
if %errorlevel% equ 0 (
  py -m http.server %PORT%
  goto :fin
)

echo [ERROR] No se encontro Node.js ni Python.
pause
exit /b 1

:fin
echo.
pause
