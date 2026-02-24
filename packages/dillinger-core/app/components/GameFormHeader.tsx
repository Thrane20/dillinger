interface GameFormHeaderProps {
  mode: 'add' | 'edit';
  hasIgdbId: boolean;
  isRefreshing: boolean;
  onRefreshFromScraper: () => void;
  error: string | null;
  successMessage: string | null;
}

export default function GameFormHeader({
  mode,
  hasIgdbId,
  isRefreshing,
  onRefreshFromScraper,
  error,
  successMessage,
}: GameFormHeaderProps) {
  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text">
          {mode === 'edit' ? 'Edit Game' : 'Add New Game'}
        </h2>

        {mode === 'edit' && hasIgdbId && (
          <button
            type="button"
            onClick={onRefreshFromScraper}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh from Scraper'}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-green-800 dark:text-green-200 text-sm">{successMessage}</p>
        </div>
      )}
    </div>
  );
}
