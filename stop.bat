@echo off
REM ============================================================
REM  Mortgage Strategy Lab - Detener servidor
REM ============================================================
REM  Mata el proceso MortgageStrategyLab.exe (el servidor)
REM  y cierra cualquier ventana de PowerShell asociada.
REM ============================================================

echo.
echo [INFO] Deteniendo servidor Mortgage Strategy Lab...
echo.

REM Matar el .exe principal.
taskkill /im MortgageStrategyLab.exe /f >nul 2>&1
if %errorlevel% equ 0 (
  echo [OK] MortgageStrategyLab.exe detenido.
) else (
  echo [INFO] MortgageStrategyLab.exe no estaba en ejecucion.
)

REM Tambien matar posibles残留 procesos node.exe del modo dev.
for /f "tokens=2" %%I in ('wmic process where "name='node.exe' and commandline like '%%server.cjs%%'" get processid /format:list 2^>nul ^| findstr /r /v "^$"') do (
  taskkill /pid %%I /f >nul 2>&1
)

REM Limpiar puertos 8765-8770 por si acaso.
for /L %%P in (8765,1,8770) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr ":%%P "') do (
    taskkill /pid %%I /f >nul 2>&1
  )
)

echo [OK] Servidor detenido.
echo.
pause
