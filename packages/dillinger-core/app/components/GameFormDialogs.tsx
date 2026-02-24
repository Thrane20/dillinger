import InstallGameDialog from './InstallGameDialog';
import ShortcutSelectorDialog, { type ShortcutInfo } from './ShortcutSelectorDialog';
import FileExplorer from './FileExplorer';
import ContainerLogsDialog from './ContainerLogsDialog';
import WineInstallationMonitorModal from './WineInstallationMonitorModal';

interface GameFormDialogsProps {
  gameId?: string;
  platformId: string;
  gameTitle: string;
  launchWorkingDirectory?: string;
  showInstallDialog: boolean;
  showShortcutDialog: boolean;
  showFileExplorer: boolean;
  showRomFileExplorer: boolean;
  showLogsDialog: boolean;
  showWineMonitorModal: boolean;
  activeInstallPath?: string;
  onInstallDialogClose: () => void;
  onInstallSuccess: () => void;
  onShortcutDialogClose: () => void;
  onSelectShortcut: (shortcut: ShortcutInfo) => void;
  onBrowseManually: () => void;
  onFileExplorerClose: () => void;
  onFileExplorerSelect: (path: string) => void;
  onRomExplorerClose: () => void;
  onRomFileSelect: (path: string) => void;
  onLogsClose: () => void;
  onWineMonitorClose: () => void;
  onWineMonitorCancel: () => void;
  getRomsBrowsePath: () => string;
}

export default function GameFormDialogs({
  gameId,
  platformId,
  gameTitle,
  launchWorkingDirectory,
  showInstallDialog,
  showShortcutDialog,
  showFileExplorer,
  showRomFileExplorer,
  showLogsDialog,
  showWineMonitorModal,
  activeInstallPath,
  onInstallDialogClose,
  onInstallSuccess,
  onShortcutDialogClose,
  onSelectShortcut,
  onBrowseManually,
  onFileExplorerClose,
  onFileExplorerSelect,
  onRomExplorerClose,
  onRomFileSelect,
  onLogsClose,
  onWineMonitorClose,
  onWineMonitorCancel,
  getRomsBrowsePath,
}: GameFormDialogsProps) {
  return (
    <>
      {showInstallDialog && gameId && platformId && (
        <InstallGameDialog
          gameId={gameId}
          platformId={platformId}
          onClose={onInstallDialogClose}
          onSuccess={onInstallSuccess}
        />
      )}

      {showShortcutDialog && gameId && activeInstallPath && (
        <ShortcutSelectorDialog
          gameId={gameId}
          installPath={activeInstallPath}
          isOpen={showShortcutDialog}
          onClose={onShortcutDialogClose}
          onSelectShortcut={onSelectShortcut}
          onBrowseManually={onBrowseManually}
        />
      )}

      {showFileExplorer && activeInstallPath && (
        <FileExplorer
          isOpen={showFileExplorer}
          onClose={onFileExplorerClose}
          onSelect={onFileExplorerSelect}
          selectMode="file"
          title="Select Game Executable"
          initialPath={launchWorkingDirectory || activeInstallPath}
        />
      )}

      {showRomFileExplorer && (
        <FileExplorer
          isOpen={showRomFileExplorer}
          onClose={onRomExplorerClose}
          onSelect={onRomFileSelect}
          selectMode="file"
          title="Select ROM File (.d64, .d81, .t64, .prg, .crt, .tap, .g64, .zip)"
          initialPath={getRomsBrowsePath()}
        />
      )}

      {showLogsDialog && gameId && (
        <ContainerLogsDialog
          gameId={gameId}
          onClose={onLogsClose}
        />
      )}

      {showWineMonitorModal && gameId && platformId === 'windows-wine' && (
        <WineInstallationMonitorModal
          gameId={gameId}
          gameTitle={gameTitle || 'Unknown Game'}
          onClose={onWineMonitorClose}
          onCancel={onWineMonitorCancel}
        />
      )}
    </>
  );
}
