'use client';

import { useState, useEffect, useRef } from 'react';

interface PairingRequest {
  pair_secret: string;
  client_ip: string;
}

interface PairingModalProps {
  isOpen: boolean;
  pairingRequest: PairingRequest | null;
  onPair: (pairSecret: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  onDismiss: () => void;
}

/**
 * Modal dialog for Moonlight pairing PIN entry
 * Appears automatically when a client is trying to pair
 */
export default function PairingModal({ isOpen, pairingRequest, onPair, onDismiss }: PairingModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [status, setStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setStatus('idle');
      setErrorMessage(null);
      // Focus first input after a short delay (wait for render)
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle individual digit input
  const handleDigitChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    // Auto-advance to next input
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === 3 && newPin.every(d => d)) {
      handleSubmit(newPin.join(''));
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const fullPin = pin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
    if (e.key === 'Escape') {
      onDismiss();
    }
  };

  // Handle paste - distribute digits across inputs
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pastedText.length > 0) {
      const newPin = [...pin];
      for (let i = 0; i < pastedText.length; i++) {
        newPin[i] = pastedText[i];
      }
      setPin(newPin);
      
      // Focus appropriate input
      const nextIndex = Math.min(pastedText.length, 3);
      inputRefs.current[nextIndex]?.focus();

      // Auto-submit if complete
      if (pastedText.length === 4) {
        handleSubmit(pastedText);
      }
    }
  };

  const handleSubmit = async (fullPin: string) => {
    if (!pairingRequest || fullPin.length !== 4) return;

    setStatus('pairing');
    setErrorMessage(null);

    try {
      const result = await onPair(pairingRequest.pair_secret, fullPin);
      
      if (result.success) {
        setStatus('success');
        // Auto-close after success
        setTimeout(() => {
          onDismiss();
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Pairing failed. Check the PIN and try again.');
        // Reset PIN for retry
        setPin(['', '', '', '']);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to communicate with streaming server');
      setPin(['', '', '', '']);
    }
  };

  if (!isOpen || !pairingRequest) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />
      
      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-soft flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text">Moonlight Pairing</h2>
          <p className="text-muted mt-2">
            A device is trying to connect
          </p>
          <p className="text-sm text-muted/80 mt-1 font-mono">
            {pairingRequest.client_ip}
          </p>
        </div>

        {/* PIN Entry */}
        {status !== 'success' && (
          <>
            <p className="text-center text-muted mb-4">
              Enter the 4-digit PIN shown on your Moonlight client
            </p>
            
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={pin[index]}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={status === 'pairing'}
                  className={`
                    w-14 h-16 text-center text-3xl font-bold rounded-xl border-2 
                    bg-background text-text
                    transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${status === 'error' ? 'border-red-500 shake' : 'border-border'}
                  `}
                  aria-label={`PIN digit ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Status Messages */}
        {status === 'pairing' && (
          <div className="flex items-center justify-center gap-2 text-muted mb-4">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Pairing...</span>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-500 font-semibold text-lg">Pairing Successful!</p>
            <p className="text-muted mt-1">You can now stream games via Moonlight</p>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-500 text-sm text-center">{errorMessage}</p>
          </div>
        )}

        {/* Actions */}
        {status !== 'success' && (
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit(pin.join(''))}
              disabled={pin.some(d => !d) || status === 'pairing'}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pair Device
            </button>
          </div>
        )}

        {/* Help text */}
        <p className="text-xs text-muted/60 text-center mt-4">
          The PIN is displayed on your Moonlight app when connecting
        </p>
      </div>

      {/* Shake animation for error state */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
