'use client';

interface Screenshot {
  filename: string;
  path: string;
  size: number;
  modified: string;
  modifiedTimestamp: number;
}

type ImageSelectorMode = 'primary' | 'backdrop' | null;

interface DisplayImagesSectionProps<TFormData extends {
  metadata: {
    primaryImage?: string;
    backdropImage?: string;
  };
}> {
  availableImages: string[];
  screenshots: Screenshot[];
  formData: TFormData;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  showImageSelector: ImageSelectorMode;
  setShowImageSelector: React.Dispatch<React.SetStateAction<ImageSelectorMode>>;
  selectImage: (imageUrl: string) => void;
  formatRelativeTime: (isoDate: string) => string;
}

export default function DisplayImagesSection<TFormData extends {
  metadata: {
    primaryImage?: string;
    backdropImage?: string;
  };
}>({
  availableImages,
  screenshots,
  formData,
  setFormData,
  showImageSelector,
  setShowImageSelector,
  selectImage,
  formatRelativeTime,
}: DisplayImagesSectionProps<TFormData>) {
  if (availableImages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      <h3 className="text-lg font-semibold text-text border-b pb-2">Display Images</h3>

      <div>
        <label className="block text-sm font-medium text-muted mb-2">
          Primary Image (Tile Display)
        </label>
        <div className="flex items-center gap-4">
          {formData.metadata.primaryImage && (
            <img
              src={formData.metadata.primaryImage}
              alt="Primary"
              className="w-24 h-24 object-cover rounded border-2 border-blue-500"
            />
          )}
          <button
            type="button"
            onClick={() => setShowImageSelector('primary')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {formData.metadata.primaryImage ? 'Change' : 'Select'} Primary Image
          </button>
          {formData.metadata.primaryImage && (
            <button
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                metadata: { ...prev.metadata, primaryImage: '' },
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-2">
          Backdrop Image (Hover Effect)
        </label>
        <div className="flex items-center gap-4">
          {formData.metadata.backdropImage && (
            <img
              src={formData.metadata.backdropImage}
              alt="Backdrop"
              className="w-32 h-18 object-cover rounded border-2 border-purple-500"
            />
          )}
          <button
            type="button"
            onClick={() => setShowImageSelector('backdrop')}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            {formData.metadata.backdropImage ? 'Change' : 'Select'} Backdrop Image
          </button>
          {formData.metadata.backdropImage && (
            <button
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                metadata: { ...prev.metadata, backdropImage: '' },
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showImageSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4 text-text">
              Select {showImageSelector === 'primary' ? 'Primary' : 'Backdrop'} Image
            </h3>

            {screenshots.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                  Your Screenshots
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {screenshots.map((screenshot) => (
                    <div
                      key={screenshot.filename}
                      onClick={() => selectImage(screenshot.path)}
                      className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded overflow-hidden transition-all group relative"
                    >
                      <img
                        src={screenshot.path}
                        alt={screenshot.filename}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                        <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 text-center">
                          {formatRelativeTime(screenshot.modified)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableImages.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-purple-500 rounded-full"></span>
                  IGDB Images
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {availableImages.map((img, index) => (
                    <div
                      key={index}
                      onClick={() => selectImage(img)}
                      className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded overflow-hidden transition-all"
                    >
                      <img
                        src={img}
                        alt={`Option ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableImages.length === 0 && screenshots.length === 0 && (
              <p className="text-center text-muted py-8">No images available</p>
            )}

            <button
              type="button"
              onClick={() => setShowImageSelector(null)}
              className="w-full px-4 py-2 mt-6 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
