import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import fs from 'fs-extra';
import * as path from 'path';

interface DownloadFile {
  url: string;
  filename: string;
  size?: number;
}

interface WorkerData {
  files: DownloadFile[];
  downloadPath: string;
  gameId: string;
  gogId: string;
  title: string;
}

/**
 * Worker thread for downloading files without blocking the main event loop
 */
async function downloadFiles() {
  const { files, downloadPath, gameId, gogId, title } = workerData as WorkerData;
  
  if (!parentPort) {
    throw new Error('This script must be run as a worker thread');
  }

  try {
    // Ensure download directory exists
    await fs.ensureDir(downloadPath);

    let completedFiles = 0;
    const totalFiles = files.length;

    for (const file of files) {
      const filePath = path.join(downloadPath, file.filename);
      
      // Send progress update
      parentPort.postMessage({
        type: 'progress',
        data: {
          gameId,
          gogId,
          title,
          totalFiles,
          completedFiles,
          currentFile: file.filename,
          currentFileProgress: 0,
          totalProgress: Math.round((completedFiles / totalFiles) * 100),
          status: 'downloading',
        },
      });

      // Check if file already exists and has correct size
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        if (file.size && stats.size === file.size) {
          console.log(`[DownloadWorker] File already exists: ${file.filename}`);
          completedFiles++;
          parentPort.postMessage({
            type: 'progress',
            data: {
              gameId,
              gogId,
              title,
              totalFiles,
              completedFiles,
              currentFile: file.filename,
              currentFileProgress: 100,
              totalProgress: Math.round((completedFiles / totalFiles) * 100),
              status: 'downloading',
            },
          });
          continue;
        }
      }

      // Download file
      await downloadFile(
        file.url,
        filePath,
        (progress) => {
          parentPort!.postMessage({
            type: 'progress',
            data: {
              gameId,
              gogId,
              title,
              totalFiles,
              completedFiles,
              currentFile: file.filename,
              currentFileProgress: progress,
              totalProgress: Math.round(
                ((completedFiles + progress / 100) / totalFiles) * 100
              ),
              status: 'downloading',
            },
          });
        }
      );

      completedFiles++;
      parentPort.postMessage({
        type: 'progress',
        data: {
          gameId,
          gogId,
          title,
          totalFiles,
          completedFiles,
          currentFile: file.filename,
          currentFileProgress: 100,
          totalProgress: Math.round((completedFiles / totalFiles) * 100),
          status: 'downloading',
        },
      });
    }

    // Download completed
    parentPort.postMessage({
      type: 'completed',
      data: {
        gameId,
        gogId,
        title,
        totalFiles,
        completedFiles,
        currentFile: '',
        currentFileProgress: 100,
        totalProgress: 100,
        status: 'completed',
      },
    });
  } catch (error) {
    // Download failed
    parentPort!.postMessage({
      type: 'failed',
      data: {
        gameId,
        gogId,
        title,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Download a single file with progress tracking
 */
async function downloadFile(
  url: string,
  filePath: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 60000, // 60 second timeout
    onDownloadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onProgress(progress);
      }
    },
  });

  const writer = fs.createWriteStream(filePath);
  
  return new Promise((resolve, reject) => {
    let errorOccurred = false;

    // Handle stream errors
    response.data.on('error', (error: Error) => {
      errorOccurred = true;
      writer.destroy();
      reject(new Error(`Stream error: ${error.message}`));
    });

    writer.on('error', (error: Error) => {
      errorOccurred = true;
      response.data.destroy();
      reject(new Error(`Write error: ${error.message}`));
    });

    writer.on('finish', () => {
      if (!errorOccurred) {
        resolve();
      }
    });

    response.data.pipe(writer);
  });
}

// Start downloading
downloadFiles().catch((error) => {
  console.error('[DownloadWorker] Fatal error:', error);
  process.exit(1);
});
