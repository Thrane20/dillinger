import { Suspense } from 'react';

import GogCallbackClient from './GogCallbackClient';

export default function GOGCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="card max-w-md">
            <div className="card-body text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <h2 className="text-xl font-semibold text-text">Processing GOG authentication...</h2>
            </div>
          </div>
        </div>
      }
    >
      <GogCallbackClient />
    </Suspense>
  );
}
