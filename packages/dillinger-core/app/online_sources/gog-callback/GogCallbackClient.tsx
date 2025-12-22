'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function GogCallbackClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing GOG authentication...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Authentication failed: ${error}`);
      setTimeout(() => {
        window.close();
      }, 3000);
      return;
    }

    if (code) {
      // Send the code to the parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'GOG_AUTH_SUCCESS',
            code: code,
          },
          window.location.origin
        );
        setStatus('success');
        setMessage('Authentication successful! Closing this window...');
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        setStatus('error');
        setMessage('Failed to communicate with parent window. Please close this window and try again.');
      }
    } else {
      setStatus('error');
      setMessage('No authorization code received. Please try again.');
      setTimeout(() => {
        window.close();
      }, 3000);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="card max-w-md">
        <div className="card-body text-center space-y-4">
          {status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <h2 className="text-xl font-semibold text-text">{message}</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-text">{message}</h2>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-text">{message}</h2>
              <button onClick={() => window.close()} className="btn-primary">
                Close Window
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
