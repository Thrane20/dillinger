'use strict';

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const http = require('http');
const https = require('https');

function post(type, data) {
  if (!parentPort) return;
  parentPort.postMessage({ type, data });
}

function sanitizeFilename(filename) {
  const base = path.basename(String(filename || '')).trim();
  const fallback = 'download.bin';
  const safe = base.length ? base : fallback;
  // Avoid Windows-reserved chars and path traversal (basename already strips dirs)
  return safe.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
}

function requestForUrl(url) {
  return url.startsWith('https:') ? https : http;
}

async function downloadToFile(url, destinationPath, onProgress) {
  const maxRedirects = 5;

  async function doRequest(currentUrl, redirectCount) {
    if (redirectCount > maxRedirects) {
      throw new Error(`Too many redirects while downloading: ${url}`);
    }

    return new Promise((resolve, reject) => {
      const client = requestForUrl(currentUrl);
      const req = client.get(
        currentUrl,
        {
          headers: {
            // Some CDNs reject empty UA
            'User-Agent': 'Dillinger/1.0',
          },
        },
        (res) => {
          // Redirect
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            res.resume();
            resolve(doRequest(nextUrl, redirectCount + 1));
            return;
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            const code = res.statusCode || 'unknown';
            res.resume();
            reject(new Error(`HTTP ${code} while downloading ${currentUrl}`));
            return;
          }

          const total = Number(res.headers['content-length'] || 0);
          let downloaded = 0;

          const tempPath = destinationPath + '.part';
          const out = fs.createWriteStream(tempPath);

          res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (typeof onProgress === 'function') {
              onProgress({ downloadedBytes: downloaded, totalBytes: total });
            }
          });

          res.on('error', (err) => {
            out.destroy();
            reject(err);
          });

          out.on('error', (err) => {
            res.destroy();
            reject(err);
          });

          out.on('finish', async () => {
            try {
              await fsp.rename(tempPath, destinationPath);
              resolve({ downloadedBytes: downloaded, totalBytes: total });
            } catch (e) {
              reject(e);
            }
          });

          res.pipe(out);
        }
      );

      req.on('error', reject);
    });
  }

  return doRequest(url, 0);
}

async function run() {
  const {
    files = [],
    downloadPath,
    gameId,
    gogId,
    title,
  } = workerData || {};

  if (!downloadPath || typeof downloadPath !== 'string') {
    throw new Error('Missing downloadPath');
  }

  await fsp.mkdir(downloadPath, { recursive: true });

  const totalFiles = Array.isArray(files) ? files.length : 0;
  let completedFiles = 0;

  const baseProgress = {
    gameId,
    gogId,
    title,
    totalFiles,
    completedFiles,
    currentFile: '',
    currentFileProgress: 0,
    totalProgress: 0,
    status: 'downloading',
    downloadPath,
  };

  post('progress', baseProgress);

  for (const file of files) {
    const url = String(file && file.url ? file.url : '');
    if (!url) {
      throw new Error('Invalid download URL');
    }

    const filename = sanitizeFilename(file && file.filename ? file.filename : '');
    const destinationPath = path.join(downloadPath, filename);

    let lastProgressSentAt = 0;

    const progressForFile = {
      ...baseProgress,
      completedFiles,
      currentFile: filename,
      currentFileProgress: 0,
      totalProgress: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
      status: 'downloading',
    };

    post('progress', progressForFile);

    await downloadToFile(url, destinationPath, ({ downloadedBytes, totalBytes }) => {
      const now = Date.now();
      // throttle progress events a bit
      if (now - lastProgressSentAt < 250) return;
      lastProgressSentAt = now;

      const currentFileProgress = totalBytes > 0
        ? Math.max(0, Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)))
        : 0;

      const totalProgress = totalFiles > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(((completedFiles + (currentFileProgress / 100)) / totalFiles) * 100)
            )
          )
        : currentFileProgress;

      post('progress', {
        ...baseProgress,
        completedFiles,
        currentFile: filename,
        currentFileProgress,
        totalProgress,
        status: 'downloading',
      });
    });

    completedFiles += 1;

    post('progress', {
      ...baseProgress,
      completedFiles,
      currentFile: filename,
      currentFileProgress: 100,
      totalProgress: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 100,
      status: completedFiles === totalFiles ? 'completed' : 'downloading',
    });
  }

  post('completed', {
    ...baseProgress,
    completedFiles,
    currentFile: '',
    currentFileProgress: 100,
    totalProgress: 100,
    status: 'completed',
  });
}

run().catch((err) => {
  post('failed', {
    error: err && err.message ? err.message : String(err),
  });
  // ensure non-zero exit
  process.exitCode = 1;
});
