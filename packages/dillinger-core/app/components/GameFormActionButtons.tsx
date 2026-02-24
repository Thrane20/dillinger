interface GameFormActionButtonsProps {
  isSubmitting: boolean;
  mode: 'add' | 'edit';
  onCancel?: () => void;
  onCancelFallback: () => void;
}

export default function GameFormActionButtons({
  isSubmitting,
  mode,
  onCancel,
  onCancelFallback,
}: GameFormActionButtonsProps) {
  return (
    <div className="flex gap-4 mt-6">
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (mode === 'edit' ? 'Saving...' : 'Adding...') : (mode === 'edit' ? 'Save Changes' : 'Add Game')}
      </button>
      <button
        type="button"
        onClick={() => {
          if (onCancel) {
            onCancel();
          } else {
            onCancelFallback();
          }
        }}
        className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
