// Servidor HTTP estatico minimo para Mortgage Strategy Lab.
// Uso:  node server.cjs [puerto] [--gui]
//
// --gui   Cuando se ejecuta empaquetado (.exe), abre el navegador
//         automaticamente y minimiza la ventana de consola.
//
// Tambien funciona empaquetado como .exe via pkg.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const isPkg = typeof process.pkg !== 'undefined';
const args = process.argv.slice(2);

// Parsear flags y puerto.
let PORT = 8000;
let autoOpenBrowser = false;
for (const a of args) {
  if (a === '--gui') autoOpenBrowser = true;
  else if (/^\d+$/.test(a)) PORT = parseInt(a, 10);
}

// En modo empaquetado (.exe), abrimos el navegador siempre que no se haya
// redirigido stdout (es decir, cuando el usuario hace doble clic).
const isDoubleClick = isPkg && process.stdout.isTTY === false;
if (isPkg && !process.argv.includes('--no-gui')) autoOpenBrowser = true;

const ROOT = isPkg ? path.dirname(process.execPath) : __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function readFromSnapshot(urlPath) {
  const rel = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  const virtualPath = path.join(__dirname, rel);
  return fs.readFileSync(virtualPath);
}

function readFromDisk(urlPath) {
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) return null;
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath).isFile() ? filePath : null;
}

function openBrowser(url) {
  // Elegir el comando apropiado segun la plataforma.
  let cmd, cmdArgs;
  if (process.platform === 'win32') {
    // cmd /c start "" abre la URL con el navegador por defecto y NO bloquea.
    cmd = 'cmd';
    cmdArgs = ['/c', 'start', '""', url];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    cmdArgs = [url];
  } else {
    cmd = 'xdg-open';
    cmdArgs = [url];
  }
  try {
    const child = spawn(cmd, cmdArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch (e) {
    // Silenciar: si no se puede abrir el navegador, el usuario puede abrirlo manualmente.
  }
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Alias: /favicon.ico -> /assets/icon.ico (compatibilidad con navegadores que
  // piden favicon.ico por defecto en la raiz).
  if (urlPath === '/favicon.ico') urlPath = '/assets/icon.ico';

  const ext = path.extname(urlPath).toLowerCase();

  if (isPkg) {
    try {
      const data = readFromSnapshot(urlPath);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, must-revalidate',
      });
      res.end(data);
      return;
    } catch (e) { /* not in snapshot */ }
  }

  const filePath = readFromDisk(urlPath);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + urlPath);
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache, must-revalidate',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;

  // Solo imprimir logs en modo desarrollo o cuando stdout es TTY.
  if (process.stdout.isTTY) {
    console.log('');
    console.log('  Mortgage Strategy Lab');
    console.log('  Modo: ' + (isPkg ? 'empaquetado (.exe)' : 'desarrollo'));
    console.log('  Servidor activo en: ' + url);
    console.log('  Pulsa Ctrl+C para detener.');
    console.log('');
  }

  if (autoOpenBrowser) {
    // Abrir el navegador tras un breve delay para asegurar que el server esta listo.
    setTimeout(() => openBrowser(url), 200);
  }
});
