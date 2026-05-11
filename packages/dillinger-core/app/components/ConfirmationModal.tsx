'use client';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  extraButtons?: Array<{
    text: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'destructive';
  }>;
}

export default function ConfirmationModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  extraButtons = [],
}: ConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      
      {/* Modal */}
      <div className="relative mx-4 w-full max-w-md workbench-window animate-in fade-in zoom-in-95 duration-200">
        <div className="workbench-titlebar">
          <span>{title}</span>
        </div>
        <div className="workbench-body">
          {/* Header */}
          <div className="flex items-start gap-4">
            {destructive ? (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-2 border-danger bg-danger-soft">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-2 border-primary bg-primary-soft">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <p className="mt-2 text-sm text-muted whitespace-pre-line">{message}</p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            <button
              onClick={onCancel}
              className="pixel-button"
            >
              {cancelText}
            </button>
            {extraButtons.map((btn, index) => (
              <button
                key={index}
                onClick={btn.onClick}
                className={`pixel-button ${
                  btn.variant === 'destructive'
                    ? 'pixel-button-danger'
                    : btn.variant === 'primary'
                    ? 'pixel-button-success'
                    : ''
                }`}
              >
                {btn.text}
              </button>
            ))}
            <button
              onClick={onConfirm}
              className={`pixel-button ${
                destructive
                  ? 'pixel-button-danger'
                  : 'pixel-button-success'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
