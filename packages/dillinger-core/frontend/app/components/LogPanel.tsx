'use client';

import { useState, useEffect, useRef } from 'react';

interface LogPanelProps {
  className?: string;
}

export default function LogPanel({ className = '' }: LogPanelProps) {
  const [logs, setLogs] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [containerCount, setContainerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeContainersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Connect to WebSocket
    const connectWebSocket = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws/logs';
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'logentry') {
            const { containerId, containerType, gameName, message: logMessage } = message.body;
            
            // Add container header if this is the first log from this container
            if (!activeContainersRef.current.has(containerId)) {
              activeContainersRef.current.add(containerId);
              setContainerCount(activeContainersRef.current.size);
              
              const header = `\n${'='.repeat(80)}\n[${containerType.toUpperCase()}] ${gameName}\nContainer: ${containerId.substring(0, 12)}\n${'='.repeat(80)}\n`;
              setLogs(prev => prev + header);
            }
            
            // Append log message
            setLogs(prev => prev + logMessage + '\n');
            
            // Auto-scroll to bottom
            if (scrollRef.current) {
              setTimeout(() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }, 50);
            }
          } else if (message.type === 'container-started') {
            const { containerId, containerType, gameName } = message.body;
            activeContainersRef.current.add(containerId);
            setContainerCount(activeContainersRef.current.size);
            
            const header = `\n${'='.repeat(80)}\n[${containerType.toUpperCase()}] ${gameName} (starting...)\nContainer: ${containerId.substring(0, 12)}\n${'='.repeat(80)}\n`;
            setLogs(prev => prev + header);
          } else if (message.type === 'container-stopped') {
            const { containerId } = message.body;
            activeContainersRef.current.delete(containerId);
            setContainerCount(activeContainersRef.current.size);
            
            setLogs(prev => prev + `\n[Container ${containerId.substring(0, 12)} stopped]\n`);
          } else if (message.type === 'connected') {
            console.log('WebSocket connection confirmed:', message.body.message);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleClear = () => {
    setLogs('');
    activeContainersRef.current.clear();
    setContainerCount(0);
    setError(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Container Logs</h3>
          {isConnected ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-success/20 text-success rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
              Live
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium bg-error/20 text-error rounded-full">
              Disconnected
            </span>
          )}
          {containerCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
              {containerCount} active
            </span>
          )}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleClear}
          className="btn btn-sm btn-error flex-1"
          title="Clear log display"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
          Error: {error}
        </div>
      )}

      {/* Log display area - 1/6 screen height + scroll */}
      <div
        ref={scrollRef}
        className="font-mono text-xs bg-black/90 text-green-400 p-3 rounded border border-primary/30 overflow-y-auto whitespace-pre-wrap break-all"
        style={{ 
          height: 'calc(100vh / 6)',
          minHeight: '150px',
          maxHeight: '300px'
        }}
      >
        {logs || (isConnected ? 'Waiting for container logs...' : 'Connecting to log stream...')}
      </div>

      {/* Info text */}
      <p className="text-xs text-muted italic">
        Real-time logs from active game launches and installations. Wine logs included for Windows games.
      </p>
    </div>
  );
}
