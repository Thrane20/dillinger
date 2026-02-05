'use client';

import { ReactNode } from 'react';
import { PairingProvider } from './PairingProvider';

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper
 * Wraps children with context providers that require client-side hooks
 */
export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PairingProvider autoStart={true} pollInterval={3000}>
      {children}
    </PairingProvider>
  );
}
