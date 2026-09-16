#!/usr/bin/env node
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Ensure ./data exists
const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Media static file server on :8888 (if media directory exists)
const mediaDir = path.join(ROOT, 'media');
const mediaServer = http.createServer((req, res) => {
  const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(mediaDir, safePath);

  if (!filePath.startsWith(mediaDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=86400'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

mediaServer.listen(8888, '0.0.0.0', () => {
  console.log('\x1b[36m[media]\x1b[0m Media server listening on http://0.0.0.0:8888');
});

// Start API server
const envFile = path.join(ROOT, '.env');
const apiArgs = fs.existsSync(envFile) ? ['--env-file=' + envFile, 'server.js'] : ['server.js'];
const apiProcess = spawn('node', apiArgs, {
  cwd: path.join(ROOT, 'api'),
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DATA_DIR: path.join(ROOT, 'data'),
    PORT: '3000',
    RP_ID: 'localhost',
    ORIGIN: 'http://localhost:8080'
  }
});

apiProcess.stdout.on('data', data => {
  process.stdout.write(`\x1b[32m[api]\x1b[0m ${data}`);
});
apiProcess.stderr.on('data', data => {
  process.stderr.write(`\x1b[31m[api err]\x1b[0m ${data}`);
});

// Start Frontend dev server
const frontendProcess = spawn('npm', ['run', 'dev', '--', '--host', '--port', '8080'], {
  cwd: path.join(ROOT, 'frontend'),
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: '8080'
  }
});

frontendProcess.stdout.on('data', data => {
  process.stdout.write(`\x1b[35m[web]\x1b[0m ${data}`);
});
frontendProcess.stderr.on('data', data => {
  process.stderr.write(`\x1b[33m[web err]\x1b[0m ${data}`);
});

const cleanup = () => {
  console.log('\nShutting down local openGym services...');
  try { mediaServer.close(); } catch {}
  try { apiProcess.kill('SIGTERM'); } catch {}
  try { frontendProcess.kill('SIGTERM'); } catch {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
