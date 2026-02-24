import type { WineGamePhase } from '@dillinger/shared';
import Link from 'next/link';

interface WineStatusBannerProps {
  phase: WineGamePhase;
  gameId?: string;
  onOpenMonitor?: () => void;
  onLaunch?: () => void;
}

const PHASE_COPY: Record<
  WineGamePhase,
  {
    title: string;
    subtitle: string;
    className: string;
  }
> = {
  needs_install: {
    title: 'Not Installed',
    subtitle: 'Install this game first before configuring advanced Wine settings.',
    className: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100',
  },
  installing: {
    title: 'Installation In Progress',
    subtitle: 'Wine prefix creation and installer execution are running. This can take a few minutes.',
    className: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100',
  },
  install_failed: {
    title: 'Installation Failed',
    subtitle: 'Review logs, adjust settings, and reinstall.',
    className: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100',
  },
  post_install: {
    title: 'Installed — Select Executable',
    subtitle: 'Set the main executable so Dillinger knows what to launch.',
    className: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100',
  },
  needs_configuration: {
    title: 'Needs Configuration',
    subtitle: 'Game is launchable, but MakeItRun tweaks are still recommended.',
    className: 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-100',
  },
  ready: {
    title: 'Ready To Run',
    subtitle: 'Installation and launch command are configured.',
    className: 'border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-900/30 dark:text-green-100',
  },
  running: {
    title: 'Currently Running',
    subtitle: 'A session is currently active for this game.',
    className: 'border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-900/30 dark:text-green-100',
  },
};

export default function WineStatusBanner({ phase, gameId, onOpenMonitor, onLaunch }: WineStatusBannerProps) {
  const copy = PHASE_COPY[phase];

  return (
    <div className={`mb-6 rounded-lg border p-4 transition-colors duration-300 ease-out ${copy.className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{copy.title}</div>
          <div className="mt-1 text-xs opacity-90">{copy.subtitle}</div>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'installing' && onOpenMonitor && (
            <button
              type="button"
              onClick={onOpenMonitor}
              className="rounded-md border border-current/30 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Open Monitor
            </button>
          )}

          {phase === 'ready' && onLaunch && (
            <button
              type="button"
              onClick={onLaunch}
              className="rounded-md border border-current/30 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Launch Game
            </button>
          )}

          {(phase === 'ready' || phase === 'needs_configuration') && gameId && (
            <Link
              href={`/?scrollTo=${gameId}`}
              className="rounded-md border border-current/30 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Back To Library
            </Link>
          )}

          {phase === 'running' && gameId && (
            <Link
              href={`/sessions?gameId=${gameId}`}
              className="rounded-md border border-current/30 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              View Session
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
