import { Suspense } from 'react';

import GameScrapeClient from './GameScrapeClient';

interface PageProps {
  params: {
    id: string;
  };
}

export default function GameScrapePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-8 max-w-6xl">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <div className="text-xl">Loading scrape UI...</div>
            </div>
          </div>
        </div>
      }
    >
      <GameScrapeClient params={params} />
    </Suspense>
  );
}
