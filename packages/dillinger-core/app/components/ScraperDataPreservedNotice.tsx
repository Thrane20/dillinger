interface ScraperDataPreservedNoticeProps {
  similarGamesCount?: number;
}

export default function ScraperDataPreservedNotice({
  similarGamesCount,
}: ScraperDataPreservedNoticeProps) {
  if (!similarGamesCount) {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
      <div className="flex items-start gap-2">
        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">Scraper Data Preserved</p>
          <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
            This game has {similarGamesCount} similar titles and other scraper metadata that will be automatically preserved when saving your changes.
          </p>
        </div>
      </div>
    </div>
  );
}
