import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || '4173');
const host = '0.0.0.0';
const rootDir = join(process.cwd(), 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  return normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
}

function sendFile(res, absolutePath) {
  const extension = extname(absolutePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(absolutePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const requestPath = safePath(req.url || '/');
  const absolutePath = join(rootDir, requestPath);

  try {
    if (existsSync(absolutePath) && (await stat(absolutePath)).isFile()) {
      sendFile(res, absolutePath);
      return;
    }

    sendFile(res, join(rootDir, 'index.html'));
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Failed to serve frontend');
  }
});

server.listen(port, host, () => {
  console.log(`Frontend started at http://${host}:${port}`);
});
