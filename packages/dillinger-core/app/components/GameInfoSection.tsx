'use client';

interface Screenshot {
  filename: string;
  path: string;
  size: number;
  modified: string;
  modifiedTimestamp: number;
}

interface GameInfoSectionProps<TFormData extends {
  metadata: {
    description?: string;
    genre?: string;
    developer?: string;
    publisher?: string;
    releaseDate?: string;
    rating?: number;
    primaryImage?: string;
  };
}> {
  mode: 'add' | 'edit';
  formData: TFormData;
  screenshots: Screenshot[];
  currentScreenshotIndex: number;
  setCurrentScreenshotIndex: React.Dispatch<React.SetStateAction<number>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  sectionRef: (el: HTMLDivElement | null) => void;
}

export default function GameInfoSection<TFormData extends {
  metadata: {
    description?: string;
    genre?: string;
    developer?: string;
    publisher?: string;
    releaseDate?: string;
    rating?: number;
    primaryImage?: string;
  };
}>({
  mode,
  formData,
  screenshots,
  currentScreenshotIndex,
  setCurrentScreenshotIndex,
  handleChange,
  setFormData,
  sectionRef,
}: GameInfoSectionProps<TFormData>) {
  return (
    <div
      id="game-info"
      ref={sectionRef}
      className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6"
    >
      <h3 className="text-lg font-semibold text-text border-b pb-2">Game Information</h3>

      <div>
        <label htmlFor="metadata.description" className="block text-sm font-medium text-muted mb-2">
          Description
        </label>
        <textarea
          id="metadata.description"
          name="metadata.description"
          value={formData.metadata.description}
          onChange={handleChange}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          placeholder="Brief description of the game"
        />
      </div>

      <div>
        <label htmlFor="metadata.genre" className="block text-sm font-medium text-muted mb-2">
          Genre
        </label>
        <input
          type="text"
          id="metadata.genre"
          name="metadata.genre"
          value={formData.metadata.genre}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          placeholder="Action, RPG, Strategy (comma-separated)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="metadata.developer" className="block text-sm font-medium text-muted mb-2">
            Developer
          </label>
          <input
            type="text"
            id="metadata.developer"
            name="metadata.developer"
            value={formData.metadata.developer}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
            placeholder="Game developer"
          />
        </div>

        <div>
          <label htmlFor="metadata.publisher" className="block text-sm font-medium text-muted mb-2">
            Publisher
          </label>
          <input
            type="text"
            id="metadata.publisher"
            name="metadata.publisher"
            value={formData.metadata.publisher}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
            placeholder="Game publisher"
          />
        </div>

        <div>
          <label htmlFor="metadata.releaseDate" className="block text-sm font-medium text-muted mb-2">
            Release Date
          </label>
          <input
            type="date"
            id="metadata.releaseDate"
            name="metadata.releaseDate"
            value={formData.metadata.releaseDate}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          />
        </div>

        <div>
          <label htmlFor="metadata.rating" className="block text-sm font-medium text-muted mb-2">
            Rating (1-10)
          </label>
          <input
            type="number"
            id="metadata.rating"
            name="metadata.rating"
            min="1"
            max="10"
            value={formData.metadata.rating || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
            placeholder="1-10"
          />
        </div>
      </div>

      {mode === 'edit' && (
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-text">📸 Screenshots</h4>

          {screenshots.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-muted">No screenshots captured yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Use the emulator screenshot hotkey (RetroArch default: F8) to capture screenshots.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-w-2xl">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black max-h-64">
                <img
                  src={screenshots[currentScreenshotIndex]?.path}
                  alt={`Screenshot ${currentScreenshotIndex + 1}`}
                  className="w-full h-full object-contain"
                />

                {screenshots.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentScreenshotIndex(
                          (prev) => (prev - 1 + screenshots.length) % screenshots.length
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                      title="Previous"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentScreenshotIndex(
                          (prev) => (prev + 1) % screenshots.length
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                      title="Next"
                    >
                      ›
                    </button>
                  </>
                )}

                <div className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-black/60 text-white rounded">
                  {currentScreenshotIndex + 1} / {screenshots.length}
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {screenshots.map((screenshot, index) => (
                  <button
                    key={screenshot.filename}
                    type="button"
                    onClick={() => setCurrentScreenshotIndex(index)}
                    className={`flex-shrink-0 border rounded overflow-hidden ${
                      index === currentScreenshotIndex
                        ? 'border-blue-500 ring-2 ring-blue-400'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <img
                      src={screenshot.path}
                      alt={`Screenshot ${index + 1}`}
                      className="h-16 w-24 object-cover"
                    />
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = screenshots[currentScreenshotIndex];
                    if (!current) return;
                    setFormData((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, primaryImage: current.path },
                    }));
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Use as Cover
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = screenshots[currentScreenshotIndex];
                    if (current) window.open(current.path, '_blank');
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  View Full Size
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
