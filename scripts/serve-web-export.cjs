const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../amplify-rewrites.json');
const spaPath = new RegExp(rules[0].source.slice(2, -2));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

function createExportServer(directory) {
  const root = path.resolve(directory);
  return http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400); response.end(); return; }
    let file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(404); response.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (!spaPath.test(pathname)) { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); return; }
      file = path.join(root, 'index.html');
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file).pipe(response);
  });
}

if (require.main === module) {
  const directory = process.argv[2] ?? path.join(__dirname, '../dist');
  const port = Number(process.env.PORT ?? 4173);
  createExportServer(directory).listen(port, '127.0.0.1', () => console.log(`Export server: http://127.0.0.1:${port}`));
}
module.exports = { createExportServer };
