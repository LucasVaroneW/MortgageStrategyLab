// build-exe.mjs - Empaqueta Mortgage Strategy Lab como ejecutable standalone.
// Resultado: ./dist/MortgageStrategyLab.exe (~36 MB, con icono Windows).
//
// Requisito previo (solo una vez):
//   npm install --save-dev pkg sharp
//   node build-icons.mjs    # genera assets/icon.ico desde el SVG
//
// Uso:
//   node build-exe.mjs                  # genera el .exe para Windows
//   node build-exe.mjs --linux          # genera para Linux
//   node build-exe.mjs --macos          # genera para macOS
//   node build-exe.mjs --all            # genera para los tres
//
// Después de generar:
//   - start.bat (doble clic) lanza el .exe sin ventana visible y abre el navegador.
//   - stop.bat detiene el servidor.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const targetMap = {
  win:    { target: 'node18-win-x64',    ext: '.exe' },
  linux:  { target: 'node18-linux-x64',  ext: '' },
  macos:  { target: 'node18-macos-x64',  ext: '' },
};

function shouldBuild(key) {
  if (args.length === 0) return key === 'win';
  if (args.includes('--all')) return true;
  return args.includes(`--${key}`);
}

// Verificar que pkg está instalado.
const pkgEntry = path.join(__dirname, 'node_modules', 'pkg', 'lib-es5', 'bin.js');
if (!fs.existsSync(pkgEntry)) {
  console.error('\n[ERROR] Falta el paquete "pkg". Ejecuta primero:');
  console.error('  npm install --save-dev pkg\n');
  process.exit(1);
}

// Verificar que el icono existe (solo Windows).
const iconPath = path.join(__dirname, 'assets', 'icon.ico');
if (!fs.existsSync(iconPath)) {
  console.warn('\n[WARN] No se encontró assets/icon.ico. El .exe no tendrá icono.');
  console.warn('       Ejecuta primero: node build-icons.mjs\n');
}

const distDir = path.join(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const baseName = 'MortgageStrategyLab';
const configPath = path.join(__dirname, 'pkg.config.json');

function runPkg(target, outPath) {
  return new Promise((resolve, reject) => {
    const pkgArgs = [
      pkgEntry,
      'server.cjs',
      '--targets', target,
      '--output', outPath,
      '--config', configPath,
    ];
    // Solo Windows soporta icono en el binario.
    if (target.includes('win') && fs.existsSync(iconPath)) {
      pkgArgs.push('--icon', iconPath);
    }
    const child = spawn(process.execPath, pkgArgs, { cwd: __dirname, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`pkg exited with code ${code}`)));
  });
}

console.log('\n  Empaquetando Mortgage Strategy Lab como ejecutable...\n');

(async () => {
  for (const [key, info] of Object.entries(targetMap)) {
    if (!shouldBuild(key)) continue;
    const outName = baseName + info.ext;
    const outPath = path.join(distDir, outName);
    console.log(`[BUILD] ${key.padEnd(8)} -> ${outName}`);
    try {
      await runPkg(info.target, outPath);
      const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
      console.log(`[OK]    ${outName} (${sizeMB} MB)\n`);
    } catch (e) {
      console.error(`[FAIL]  ${key}: ${e.message}\n`);
    }
  }

  if (shouldBuild('win')) {
    const startBat = `@echo off
REM ============================================================
REM  Mortgage Strategy Lab - Lanzador (doble clic para abrir)
REM ============================================================
REM  Arranca MortgageStrategyLab.exe SIN ventana visible usando
REM  PowerShell (WindowStyle Hidden) y abre el navegador.
REM ============================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set EXE=MortgageStrategyLab.exe
set PS1=launch-hidden.ps1
set PORT=8765

if not exist "%EXE%" (
  echo.
  echo [ERROR] No se encontro %EXE%
  pause
  exit /b 1
)

if not exist "%PS1%" (
  echo.
  echo [ERROR] No se encontro %PS1%
  pause
  exit /b 1
)

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

for /f "tokens=*" %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0%PS1%" -ExePath "%~dp0%EXE%" -Port %PORT%') do set SERVER_PID=%%I

if "!SERVER_PID!"=="" (
  echo [ERROR] No se pudo arrancar el servidor.
  if exist msl-err.log type msl-err.log
  pause
  exit /b 1
)

echo [INFO] Servidor arrancado (PID !SERVER_PID!).

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
exit /b 0
`;
    const stopBat = `@echo off
taskkill /im MortgageStrategyLab.exe /f >nul 2>&1
echo.
echo  Servidor detenido.
echo.
pause
`;
    const launchPs1 = `# launch-hidden.ps1
# Lanza MortgageStrategyLab.exe sin ventana visible.
# Usado por start.bat.

param(
  [string]$ExePath = "$PSScriptRoot\\MortgageStrategyLab.exe",
  [int]$Port = 8765
)

if (-not (Test-Path $ExePath)) {
  Write-Error "No se encontro: $ExePath"
  exit 1
}

# Start-Process en una sola linea para evitar problemas de continuacion.
$proc = Start-Process -FilePath $ExePath -ArgumentList "$Port" -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot\\msl-out.log" -RedirectStandardError "$PSScriptRoot\\msl-err.log" -PassThru

if ($null -eq $proc) {
  Write-Error "Start-Process fallo"
  exit 1
}

Write-Output $proc.Id
exit 0
`;
    fs.writeFileSync(path.join(distDir, 'start.bat'), startBat);
    fs.writeFileSync(path.join(distDir, 'stop.bat'), stopBat);
    fs.writeFileSync(path.join(distDir, 'launch-hidden.ps1'), launchPs1);
    console.log('[INFO] start.bat, stop.bat y launch-hidden.ps1 creados junto al .exe\n');
  }

  console.log('========================================');
  console.log('  Empaquetado completado');
  console.log('  Archivos en: ./dist/');
  console.log('========================================\n');

  // Post-proceso: inyectar icono y cambiar subsystem a WINDOWS_GUI.
  if (shouldBuild('win')) {
    const { spawn } = await import('node:child_process');
    const postbuild = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['postbuild-exe.mjs'], { cwd: __dirname, stdio: 'inherit' });
      child.on('exit', code => resolve(code));
    });
    if (postbuild !== 0) {
      console.error('[FAIL] postbuild-exe.mjs fallo con codigo ' + postbuild);
      process.exit(1);
    }
  }
})();
