'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePairing } from '../components/PairingProvider';

interface PairedClient {
  client_id: string;
  app_state_folder?: string;
}

export default function StreamingPage() {
  const { status, isPolling, refreshStatus, clearPairedClients } = usePairing();
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  // Initial refresh on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleClearClients = async () => {
    if (!confirm('Are you sure you want to unpair all clients? They will need to pair again.')) {
      return;
    }

    const result = await clearPairedClients();
    if (result.success) {
      setClearStatus('All clients cleared successfully');
      setTimeout(() => setClearStatus(null), 3000);
    } else {
      setClearStatus(`Failed to clear: ${result.error}`);
      setTimeout(() => setClearStatus(null), 5000);
    }
  };

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">🎮 Moonlight Streaming</h1>
          <div className="animate-pulse">Loading streaming status...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">🎮 Moonlight Streaming</h1>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Back to Games
          </Link>
        </div>

        {/* Streaming Sidecar Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${status?.sidecarRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
            Streaming Sidecar
          </h2>
          
          {status?.sidecarRunning ? (
            <div className="text-green-400">
              <p>Streaming sidecar is running and ready for connections</p>
              {status?.containerId && (
                <p className="text-sm text-gray-400 mt-1 font-mono">
                  Container: {status.containerId.substring(0, 12)}
                </p>
              )}
            </div>
          ) : (
            <div className="text-yellow-400">
              <p className="mb-2">Streaming sidecar is not currently running.</p>
              <p className="text-sm text-gray-400">
                Start a game with streaming enabled, or use the test stream feature 
                in Settings → Streaming to start the sidecar.
              </p>
            </div>
          )}
        </div>

        {/* Pending Pairing Notification */}
        {status?.pendingPairings && status.pendingPairings.length > 0 && (
          <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-yellow-400">
              🔐 Pending Pairing Request{status.pendingPairings.length > 1 ? 's' : ''}
            </h2>
            <p className="text-gray-300 mb-4">
              A Moonlight client is trying to pair. A PIN entry dialog should appear automatically.
              If you don&apos;t see it, check your notification settings.
            </p>
            {status.pendingPairings.map((request) => (
              <div key={request.pair_secret} className="bg-gray-800 rounded-lg p-4 mb-2">
                <p>
                  <span className="text-gray-400">Client IP:</span>{' '}
                  <span className="font-mono text-white">{request.client_ip}</span>
                </p>
              </div>
            ))}
          </div>
        )}
        {/* Paired Clients */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">📱 Paired Clients</h2>
            {status?.pairedClients && status.pairedClients.length > 0 && (
              <button
                onClick={handleClearClients}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Clear All
              </button>
            )}
          </div>
          
          {clearStatus && (
            <p className={`mb-4 text-sm ${clearStatus.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
              {clearStatus}
            </p>
          )}
          
          {status?.pairedClients && status.pairedClients.length > 0 ? (
            <ul className="space-y-2">
              {status.pairedClients.map((client: PairedClient) => (
                <li key={client.client_id} className="flex items-center gap-2 text-gray-300">
                  <span className="text-green-400">✓</span>
                  <span className="font-mono text-sm">{client.client_id.substring(0, 16)}...</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No clients paired yet</p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📖 How to Connect</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Enable streaming for a game in Dillinger (Game Settings → Moonlight → Enable)</li>
            <li>Launch the game - the streaming sidecar will start automatically</li>
            <li>Open <a href="https://moonlight-stream.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Moonlight</a> on your client device (PC, phone, tablet, TV)</li>
            <li>Add this server&apos;s IP address in Moonlight</li>
            <li>When Moonlight shows a PIN, a dialog will appear automatically</li>
            <li>Enter the PIN to pair, then select the game to start streaming!</li>
          </ol>
          
          <div className="mt-6 p-4 bg-gray-700 rounded">
            <h3 className="font-semibold mb-2">🌐 Server Ports</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li><span className="font-mono">47984</span> - HTTPS (pairing)</li>
              <li><span className="font-mono">47989</span> - HTTP (discovery)</li>
              <li><span className="font-mono">47999</span> - Control</li>
              <li><span className="font-mono">48010</span> - RTSP (streaming)</li>
            </ul>
          </div>
        </div>

        {/* Polling status indicator */}
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-gray-400">
          <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
          <span>{isPolling ? 'Auto-refreshing' : 'Refresh paused'}</span>
          <button
            onClick={() => refreshStatus()}
            className="text-blue-400 hover:text-blue-300 ml-2"
          >
            Refresh now
          </button>
        </div>
      </div>
    </div>
  );
}
