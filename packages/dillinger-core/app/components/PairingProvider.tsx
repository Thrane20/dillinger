'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import PairingModal from './PairingModal';

interface PairingRequest {
  pair_secret: string;
  client_ip: string;
}

interface PairedClient {
  client_id: string;
  app_state_folder?: string;
}

interface StreamingStatus {
  sidecarRunning: boolean;
  wolfRunning: boolean;
  pendingPairings: PairingRequest[];
  pairedClients: PairedClient[];
  containerId?: string;
  error?: string;
}

interface PairingContextType {
  /** Current streaming status */
  status: StreamingStatus | null;
  /** Whether currently polling for status */
  isPolling: boolean;
  /** Start polling for pairing requests */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Manually refresh status */
  refreshStatus: () => Promise<void>;
  /** Submit a pairing PIN */
  submitPairing: (pairSecret: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  /** Clear all paired clients */
  clearPairedClients: () => Promise<{ success: boolean; error?: string }>;
  /** Dismiss the current pairing modal without pairing */
  dismissPairing: () => void;
}

const PairingContext = createContext<PairingContextType | undefined>(undefined);

interface PairingProviderProps {
  children: ReactNode;
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Auto-start polling when provider mounts */
  autoStart?: boolean;
}

/**
 * Provider component that handles Moonlight pairing globally
 * 
 * Features:
 * - Polls streaming status API for pending pairing requests
 * - Shows modal automatically when a pairing request is detected
 * - Persists paired clients in Wolf config
 */
export function PairingProvider({ children, pollInterval = 2000, autoStart = true }: PairingProviderProps) {
  const [status, setStatus] = useState<StreamingStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollIntervalId, setPollIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dismissedSecrets, setDismissedSecrets] = useState<Set<string>>(new Set());

  // Fetch streaming status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/streaming/status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data);
      
      // Check for new pending pairings that haven't been dismissed
      if (data.pendingPairings && data.pendingPairings.length > 0) {
        const hasNewPairing = data.pendingPairings.some(
          (p: PairingRequest) => !dismissedSecrets.has(p.pair_secret)
        );
        if (hasNewPairing) {
          setShowModal(true);
        }
      } else {
        // No pending pairings, reset dismissed secrets
        setDismissedSecrets(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch streaming status:', error);
      // Don't clear status on error, keep showing last known state
    }
  }, [dismissedSecrets]);

  // Start polling
  const startPolling = useCallback(() => {
    if (isPolling) return;
    
    setIsPolling(true);
    fetchStatus(); // Immediate fetch
    
    const id = setInterval(fetchStatus, pollInterval);
    setPollIntervalId(id);
  }, [isPolling, fetchStatus, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      setPollIntervalId(null);
    }
    setIsPolling(false);
  }, [pollIntervalId]);

  // Manual refresh
  const refreshStatus = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  // Submit pairing PIN
  const submitPairing = useCallback(async (pairSecret: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/streaming/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pair',
          pair_secret: pairSecret,
          pin: pin,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh status to update paired clients list
        setTimeout(fetchStatus, 500);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Pairing failed' };
      }
    } catch (error) {
      console.error('Pairing error:', error);
      return { success: false, error: 'Failed to communicate with server' };
    }
  }, [fetchStatus]);

  // Clear all paired clients
  const clearPairedClients = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/streaming/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTimeout(fetchStatus, 500);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to clear clients' };
      }
    } catch (error) {
      console.error('Clear clients error:', error);
      return { success: false, error: 'Failed to communicate with server' };
    }
  }, [fetchStatus]);

  // Dismiss pairing modal for current request
  const dismissPairing = useCallback(() => {
    setShowModal(false);
    // Mark current pending pairings as dismissed
    if (status?.pendingPairings) {
      const newDismissed = new Set(dismissedSecrets);
      status.pendingPairings.forEach(p => newDismissed.add(p.pair_secret));
      setDismissedSecrets(newDismissed);
    }
  }, [status, dismissedSecrets]);

  // Auto-start polling
  useEffect(() => {
    if (autoStart) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [autoStart]); // Only run on mount/unmount

  // Get the first non-dismissed pending pairing for the modal
  const currentPairingRequest = status?.pendingPairings?.find(
    p => !dismissedSecrets.has(p.pair_secret)
  ) || null;

  const contextValue: PairingContextType = {
    status,
    isPolling,
    startPolling,
    stopPolling,
    refreshStatus,
    submitPairing,
    clearPairedClients,
    dismissPairing,
  };

  return (
    <PairingContext.Provider value={contextValue}>
      {children}
      <PairingModal
        isOpen={showModal && currentPairingRequest !== null}
        pairingRequest={currentPairingRequest}
        onPair={submitPairing}
        onDismiss={dismissPairing}
      />
    </PairingContext.Provider>
  );
}

/**
 * Hook to access pairing context
 */
export function usePairing() {
  const context = useContext(PairingContext);
  if (context === undefined) {
    throw new Error('usePairing must be used within a PairingProvider');
  }
  return context;
}

/**
 * Hook that only returns pairing-related data without starting polling
 * Useful for components that just want to display status
 */
export function usePairingStatus() {
  const { status, refreshStatus } = usePairing();
  return { status, refreshStatus };
}
