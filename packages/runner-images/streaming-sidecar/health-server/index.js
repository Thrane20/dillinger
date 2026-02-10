const http = require('http');
const fs = require('fs');

const port = Number(process.env.HEALTH_PORT || 9999);
const waylandDisplay = process.env.WAYLAND_DISPLAY || 'wayland-dillinger';
const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR || '/run/dillinger';
const sunshinePort = Number(process.env.SUNSHINE_WEB_PORT || 47990);
const sunshineBase = process.env.SUNSHINE_BASE_URL || `http://127.0.0.1:${sunshinePort}`;
const sunshineClientsUrl = process.env.SUNSHINE_CLIENTS_URL || `${sunshineBase}/api/clients`;
const sunshineStatusUrl = process.env.SUNSHINE_STATUS_URL || `${sunshineBase}/api/status`;

function waylandSocketPath() {
  return `${xdgRuntimeDir}/${waylandDisplay}`;
}

async function fetchJson(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (!data) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function sunshineRunning() {
  return new Promise((resolve) => {
    const req = http.get(sunshineBase, (res) => {
      resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function getClients() {
  const data = await fetchJson(sunshineClientsUrl);
  if (data && Array.isArray(data.clients)) {
    return data.clients;
  }
  return [];
}

async function getStatus() {
  const socketReady = fs.existsSync(waylandSocketPath());
  const sunshineOk = await sunshineRunning();
  const clients = await getClients();
  const status = await fetchJson(sunshineStatusUrl);

  return {
    mode: process.env.SIDECAR_MODE || 'game',
    resolution: `${process.env.RESOLUTION_WIDTH || '1920'}x${process.env.RESOLUTION_HEIGHT || '1080'}`,
    gpu: process.env.GPU_TYPE || 'auto',
    sway: {
      running: socketReady,
      socketPath: waylandSocketPath(),
    },
    sunshine: {
      running: sunshineOk,
      port: sunshinePort,
      status,
    },
    audio: {
      enabled: (process.env.AUDIO_ENABLED || 'true') === 'true',
    },
    clients,
  };
}

function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  if (req.url === '/healthz') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.url === '/readyz') {
    const socketReady = fs.existsSync(waylandSocketPath());
    const sunshineOk = await sunshineRunning();
    if (socketReady && sunshineOk) {
      sendJson(res, 200, { ready: true });
      return;
    }
    sendJson(res, 503, { ready: false, socketReady, sunshineOk });
    return;
  }

  if (req.url === '/streamz') {
    const clients = await getClients();
    if (clients.length > 0) {
      sendJson(res, 200, { streaming: true, clientCount: clients.length });
      return;
    }
    sendJson(res, 503, { streaming: false, clientCount: 0 });
    return;
  }

  if (req.url === '/status') {
    const payload = await getStatus();
    sendJson(res, 200, payload);
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(port, '0.0.0.0');
