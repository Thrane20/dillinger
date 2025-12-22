import { Suspense } from 'react';

import ScrapersClient from './ScrapersClient';

export default function ScrapersPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-8 max-w-6xl">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <div className="text-xl">Loading scrapers...</div>
            </div>
          </div>
        </div>
      }
    >
      <ScrapersClient />
    </Suspense>
  );
}
