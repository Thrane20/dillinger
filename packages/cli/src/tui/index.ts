import blessed from 'blessed';
import { getConfig } from '../utils/config.js';
import { getContainerStatus, listDockerVolumesDetailed, type DockerVolumeStatus } from '../utils/docker.js';
import {
  getCoreBootstrapStatus,
  getCoreHealthStatus,
  launchCoreGame,
  listCoreGames,
  type CoreBootstrapStatus,
  type CoreGame,
  type CoreHealthStatus,
} from '../utils/core-api.js';
import {
  buildExtraRunnerMountPath,
  createManagedBindVolume,
  getManagedVolumePersistenceHint,
  listManagedVolumes,
  upsertManagedVolume,
  type ManagedVolumeRecord,
  type ManagedVolumePurpose,
  type ManagedVolumeStorageType,
} from '../utils/managed-volumes.js';

type TabName = 'dashboard' | 'volumes' | 'games';

type RuntimeSnapshot = {
  container: Awaited<ReturnType<typeof getContainerStatus>> | null;
  bootstrap: CoreBootstrapStatus | null;
  health: CoreHealthStatus | null;
  games: CoreGame[];
  managedVolumes: ManagedVolumeRecord[];
  dockerVolumes: DockerVolumeStatus[];
  persistenceHint: string;
};

function formatTimestamp(value?: string): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max < 4) return value.slice(0, max);
  return `${value.slice(0, max - 1)}…`;
}

function getGamePlatformLabel(game: CoreGame): string {
  if (game.defaultPlatformId) return game.defaultPlatformId;
  if (game.platformId) return game.platformId;
  if (game.platforms?.length) return game.platforms.map((platform) => platform.platformId).join(', ');
  return 'unknown';
}

function normalizeStorageType(value: string): ManagedVolumeStorageType | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'ssd' || normalized === 'platter' || normalized === 'archive') {
    return normalized;
  }
  throw new Error('Storage type must be one of: ssd, platter, archive.');
}

function normalizePurpose(value: string): ManagedVolumePurpose | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (
    normalized === 'core' ||
    normalized === 'roms' ||
    normalized === 'cache' ||
    normalized === 'installed' ||
    normalized === 'downloads' ||
    normalized === 'installers'
  ) {
    return normalized;
  }
  throw new Error('Special role must be one of: core, roms, cache, installed, downloads, installers.');
}

export async function runTui(): Promise<void> {
  const tui = new DillingerTui();
  await tui.run();
}

class DillingerTui {
  private readonly screen = blessed.screen({
    smartCSR: true,
    title: 'Dillinger Gaming',
    fullUnicode: true,
    cursor: {
      artificial: true,
      shape: 'line',
      blink: false,
      color: 'blue',
    },
  });

  private readonly header = blessed.box({
    parent: this.screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    padding: { left: 1, right: 1 },
    style: {
      fg: 'white',
      bg: 'blue',
    },
  });

  private readonly tabs = blessed.box({
    parent: this.screen,
    top: 3,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    padding: { left: 1, right: 1 },
    style: {
      fg: 'white',
      bg: 'black',
    },
  });

  private readonly dashboardBox = blessed.box({
    parent: this.screen,
    top: 6,
    left: 0,
    width: '100%',
    height: '100%-8',
    border: 'line',
    label: ' Dashboard ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    padding: { left: 1, right: 1 },
  });

  private readonly volumesList = blessed.list({
    parent: this.screen,
    top: 6,
    left: 0,
    width: '50%',
    height: '100%-8',
    border: 'line',
    label: ' Volumes ',
    keys: true,
    mouse: true,
    tags: true,
    style: {
      selected: {
        fg: 'black',
        bg: 'green',
      },
    },
  });

  private readonly volumeDetails = blessed.box({
    parent: this.screen,
    top: 6,
    left: '50%',
    width: '50%',
    height: '100%-8',
    border: 'line',
    label: ' Volume Details ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    padding: { left: 1, right: 1 },
  });

  private readonly gamesList = blessed.list({
    parent: this.screen,
    top: 6,
    left: 0,
    width: '50%',
    height: '100%-8',
    border: 'line',
    label: ' Games ',
    keys: true,
    mouse: true,
    tags: true,
    style: {
      selected: {
        fg: 'black',
        bg: 'green',
      },
    },
  });

  private readonly gameDetails = blessed.box({
    parent: this.screen,
    top: 6,
    left: '50%',
    width: '50%',
    height: '100%-8',
    border: 'line',
    label: ' Game Details ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    padding: { left: 1, right: 1 },
  });

  private readonly footer = blessed.box({
    parent: this.screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 2,
    tags: true,
    padding: { left: 1, right: 1 },
    style: {
      fg: 'white',
      bg: 'black',
    },
  });

  private activeTab: TabName = 'dashboard';
  private selectedVolumeIndex = 0;
  private selectedGameIndex = 0;
  private query = '';
  private snapshot: RuntimeSnapshot = {
    container: null,
    bootstrap: null,
    health: null,
    games: [],
    managedVolumes: [],
    dockerVolumes: [],
    persistenceHint: '',
  };
  private refreshTimer?: NodeJS.Timeout;

  private createModalOverlay(label: string, width: number, height: number): blessed.Widgets.BoxElement {
    return blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width,
      height,
      border: 'line',
      label,
      padding: { left: 1, right: 1 },
      style: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'cyan' },
      },
    });
  }

  private createModalTextbox(
    parent: blessed.Widgets.Node,
    top: number,
    value: string = '',
  ): blessed.Widgets.TextboxElement {
    return blessed.textbox({
      parent,
      top,
      left: 0,
      width: '100%-2',
      height: 1,
      inputOnFocus: true,
      value,
      fg: 'black',
      bg: 'white',
      style: {
        fg: 'black',
        bg: 'white',
        focus: {
          fg: 'black',
          bg: 'white',
        },
      },
    });
  }

  private bindEscapeToClose(elements: blessed.Widgets.BlessedElement[], close: () => void): void {
    for (const element of elements) {
      element.key(['escape'], () => close());
    }
  }

  async run(): Promise<void> {
    this.registerEvents();
    this.switchTab('dashboard');
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh(false);
    }, 8_000);

    this.screen.render();

    await new Promise<void>((resolve) => {
      this.screen.once('destroy', () => {
        if (this.refreshTimer) {
          clearInterval(this.refreshTimer);
        }
        resolve();
      });
    });
  }

  private registerEvents(): void {
    this.screen.key(['q', 'C-c'], () => this.screen.destroy());
    this.screen.key(['1'], () => this.switchTab('dashboard'));
    this.screen.key(['2'], () => this.switchTab('volumes'));
    this.screen.key(['3'], () => this.switchTab('games'));
    this.screen.key(['r'], () => {
      void this.refresh();
    });
    this.screen.key(['c'], () => {
      if (this.activeTab === 'volumes') {
        void this.openCreateVolumeDialog();
      }
    });
    this.screen.key(['/'], () => {
      if (this.activeTab === 'games') {
        void this.openSearchDialog();
      }
    });
    this.screen.key(['enter'], () => {
      if (this.activeTab === 'volumes') {
        void this.openVolumeManagementDialog();
        return;
      }
      if (this.activeTab === 'games') {
        void this.launchSelectedGame();
      }
    });

    this.volumesList.on('select', (item) => {
      this.selectedVolumeIndex = Math.max(0, this.volumesList.getItemIndex(item));
      this.renderVolumeDetails();
    });
    this.gamesList.on('select', (item) => {
      this.selectedGameIndex = Math.max(0, this.gamesList.getItemIndex(item));
      this.renderGameDetails();
    });
  }

  private switchTab(tab: TabName): void {
    this.activeTab = tab;
    this.dashboardBox.hidden = tab !== 'dashboard';
    this.volumesList.hidden = tab !== 'volumes';
    this.volumeDetails.hidden = tab !== 'volumes';
    this.gamesList.hidden = tab !== 'games';
    this.gameDetails.hidden = tab !== 'games';

    if (tab === 'dashboard') this.dashboardBox.focus();
    if (tab === 'volumes') this.volumesList.focus();
    if (tab === 'games') this.gamesList.focus();

    this.renderTabs();
    this.renderFooter();
    this.screen.render();
  }

  private setStatus(message: string): void {
    this.footer.setContent(message);
    this.screen.render();
  }

  private renderHeader(): void {
    const runtimeLabel = this.snapshot.container?.running
      ? 'container'
      : 'stopped';

    const gameCount = this.snapshot.games.length || this.snapshot.health?.counts?.games || 0;
    const managedVolumeCount = this.snapshot.managedVolumes.length;
    const port = getConfig().port;

    this.header.setContent(
      `{bold}Dillinger Gaming{/bold}  runtime={bold}${runtimeLabel}{/bold}  core=${port}  games=${gameCount}  managed-volumes=${managedVolumeCount}\n` +
        `Press {bold}1{/bold}/{bold}2{/bold}/{bold}3{/bold} to switch tabs, {bold}r{/bold} refresh, {bold}q{/bold} quit.`,
    );
  }

  private renderTabs(): void {
    const tabLabel = (tab: TabName, index: string, label: string): string =>
      this.activeTab === tab
        ? `{black-fg}{green-bg}{bold} ${index} ${label} {/bold}{/green-bg}{/black-fg}`
        : `${index} ${label}`;

    this.tabs.setContent(
      `${tabLabel('dashboard', '1', 'Dashboard')}   ${tabLabel('volumes', '2', 'Volumes')}   ${tabLabel('games', '3', 'Games')}`,
    );
  }

  private renderFooter(): void {
    if (this.activeTab === 'dashboard') {
      this.footer.setContent('Dashboard: runtime status, registration counts, and persistence hints.');
      return;
    }

    if (this.activeTab === 'volumes') {
      this.footer.setContent('Volumes: c create bind-backed volume • r refresh • managed volumes auto-mount into runners.');
      return;
    }

    this.footer.setContent(`Games: / search (${this.query || 'all'}) • enter launch selected game • r refresh.`);
  }

  private renderDashboard(): void {
    const runtimeLines = [
      '{bold}Runtime{/bold}',
      `- Container core: ${this.snapshot.container?.running ? `${this.snapshot.container.image ?? 'running'} (${this.snapshot.container.status ?? 'running'})` : 'not running'}`,
      `- Core API: ${this.snapshot.bootstrap ? `reachable (${this.snapshot.bootstrap.runtime})` : 'unreachable'}`,
      `- Started: ${formatTimestamp(this.snapshot.container?.uptime)}`,
      `- Data path: ${this.snapshot.bootstrap?.hostDataPath ?? this.snapshot.bootstrap?.dillingerCorePath ?? 'n/a'}`,
      '',
      '{bold}Counts{/bold}',
      `- Games registered: ${this.snapshot.games.length || this.snapshot.health?.counts?.games || 0}`,
      `- Platforms: ${this.snapshot.health?.counts?.platforms ?? 'n/a'}`,
      `- Sessions: ${this.snapshot.health?.counts?.sessions ?? 'n/a'}`,
      `- Collections: ${this.snapshot.health?.counts?.collections ?? 'n/a'}`,
      '',
      '{bold}Volumes{/bold}',
      `- Docker volumes detected: ${this.snapshot.dockerVolumes.length}`,
      `- Managed extra volumes: ${this.snapshot.managedVolumes.length}`,
      '',
      '{bold}Persistence{/bold}',
      `- ${this.snapshot.persistenceHint || 'Waiting for storage information...'}`,
    ];

    this.dashboardBox.setContent(runtimeLines.join('\n'));
  }

  private renderVolumes(): void {
    const managedByName = new Map(this.snapshot.managedVolumes.map((volume) => [volume.dockerVolumeName, volume]));
    const items = this.snapshot.dockerVolumes.map((volume) => {
      const managed = managedByName.get(volume.name);
      const flags = [
        managed ? '{green-fg}managed{/green-fg}' : '{gray-fg}unmanaged{/gray-fg}',
        volume.isBind ? '{cyan-fg}bind{/cyan-fg}' : '{gray-fg}docker{/gray-fg}',
        managed?.purpose ? `{yellow-fg}${managed.purpose}{/yellow-fg}` : '',
      ].join(' ');
      return `${truncate(volume.name, 32).padEnd(33)} ${flags}`;
    });

    this.volumesList.setItems(items.length > 0 ? items : ['No Docker volumes found']);
    if (items.length > 0) {
      this.selectedVolumeIndex = Math.min(this.selectedVolumeIndex, items.length - 1);
      this.volumesList.select(this.selectedVolumeIndex);
    }
    this.renderVolumeDetails();
  }

  private renderVolumeDetails(): void {
    const selected = this.snapshot.dockerVolumes[this.selectedVolumeIndex];
    if (!selected) {
      this.volumeDetails.setContent('Select a Docker volume to see details.');
      this.screen.render();
      return;
    }

    const managed = this.snapshot.managedVolumes.find((volume) => volume.dockerVolumeName === selected.name);
    const lines = [
      `{bold}${selected.name}{/bold}`,
      '',
      `Driver: ${selected.driver}`,
      `Bind-backed: ${selected.isBind ? 'yes' : 'no'}`,
      `Host path: ${selected.hostPath ?? 'n/a'}`,
      `Docker mountpoint: ${selected.mountpoint || 'n/a'}`,
      '',
      `Managed by Dillinger: ${managed ? 'yes' : 'no'}`,
      `Runner mount path: ${buildExtraRunnerMountPath(selected.name)}`,
    ];

    if (managed) {
      lines.push(
        '',
        '{bold}Managed config{/bold}',
        `Name: ${managed.name}`,
        `Stored host path: ${managed.hostPath}`,
        `Status: ${managed.status}`,
        `Friendly label: ${managed.friendlyName ?? 'n/a'}`,
        `Storage tag: ${managed.storageType ?? 'n/a'}`,
        `Special role: ${managed.purpose ?? 'general'}`,
        `Created: ${formatTimestamp(managed.createdAt)}`,
      );
    } else {
      lines.push(
        '',
        '{bold}Adoption{/bold}',
        `Friendly label: n/a`,
        `Storage tag: n/a`,
        `Special role: general`,
      );
    }

    lines.push('', '{bold}Tip{/bold}', 'Press Enter to adopt/edit this volume, or c to create a new bind-backed volume.');

    this.volumeDetails.setContent(lines.join('\n'));
    this.screen.render();
  }

  private getFilteredGames(): CoreGame[] {
    const lowerQuery = this.query.trim().toLowerCase();
    if (!lowerQuery) {
      return this.snapshot.games;
    }

    return this.snapshot.games.filter((game) => {
      const haystack = [game.title, game.slug, game.id, game.defaultPlatformId, game.platformId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(lowerQuery);
    });
  }

  private renderGames(): void {
    const filteredGames = this.getFilteredGames();
    const items = filteredGames.map((game) => {
      const playCount = game.metadata?.playCount ?? 0;
      return `${truncate(game.title, 36).padEnd(37)} ${truncate(getGamePlatformLabel(game), 12).padEnd(13)} plays=${playCount}`;
    });

    this.gamesList.setLabel(` Games (${filteredGames.length}/${this.snapshot.games.length}) `);
    this.gamesList.setItems(items.length > 0 ? items : ['No games match the current search.']);
    if (items.length > 0) {
      this.selectedGameIndex = Math.min(this.selectedGameIndex, items.length - 1);
      this.gamesList.select(this.selectedGameIndex);
    }
    this.renderGameDetails();
  }

  private renderGameDetails(): void {
    const filteredGames = this.getFilteredGames();
    const selectedGame = filteredGames[this.selectedGameIndex];
    if (!selectedGame) {
      this.gameDetails.setContent('Select a game to inspect and launch.');
      this.screen.render();
      return;
    }

    const lines = [
      `{bold}${selectedGame.title}{/bold}`,
      '',
      `ID: ${selectedGame.id}`,
      `Slug: ${selectedGame.slug ?? 'n/a'}`,
      `Default platform: ${getGamePlatformLabel(selectedGame)}`,
      `Play count: ${selectedGame.metadata?.playCount ?? 0}`,
      `Last played: ${formatTimestamp(selectedGame.metadata?.lastPlayed)}`,
      '',
      '{bold}Launch{/bold}',
      'Press enter to launch this game through the running Dillinger Core.',
    ];

    this.gameDetails.setContent(lines.join('\n'));
    this.screen.render();
  }

  private async refresh(showMessage: boolean = true): Promise<void> {
    if (showMessage) {
      this.setStatus('Refreshing Dillinger status…');
    }

    const { containerName } = getConfig();
    const [containerResult, bootstrapResult, healthResult, gamesResult, managedVolumesResult, dockerVolumesResult, hintResult] =
      await Promise.allSettled([
        getContainerStatus(containerName),
        getCoreBootstrapStatus(),
        getCoreHealthStatus(),
        listCoreGames(),
        listManagedVolumes(),
        listDockerVolumesDetailed(),
        getManagedVolumePersistenceHint(),
      ]);

    this.snapshot = {
      container: containerResult.status === 'fulfilled' ? containerResult.value : null,
      bootstrap: bootstrapResult.status === 'fulfilled' ? bootstrapResult.value : null,
      health: healthResult.status === 'fulfilled' ? healthResult.value : null,
      games: gamesResult.status === 'fulfilled' ? gamesResult.value : [],
      managedVolumes: managedVolumesResult.status === 'fulfilled' ? managedVolumesResult.value : [],
      dockerVolumes: dockerVolumesResult.status === 'fulfilled' ? dockerVolumesResult.value : [],
      persistenceHint: hintResult.status === 'fulfilled' ? hintResult.value : 'Unable to determine persistence mode.',
    };

    this.renderHeader();
    this.renderTabs();
    this.renderDashboard();
    this.renderVolumes();
    this.renderGames();
    this.renderFooter();

    if (showMessage) {
      this.setStatus('Refresh complete.');
    } else {
      this.screen.render();
    }
  }

  private async openCreateVolumeDialog(): Promise<void> {
    const overlay = this.createModalOverlay(' Create Managed Volume ', 72, 14);

    blessed.text({ parent: overlay, top: 1, left: 0, content: 'Name' });
    const nameInput = this.createModalTextbox(overlay, 2);

    blessed.text({ parent: overlay, top: 4, left: 0, content: 'Host path' });
    const pathInput = this.createModalTextbox(overlay, 5);

    const help = blessed.box({
      parent: overlay,
      top: 8,
      left: 0,
      width: '100%-2',
      height: 3,
      tags: true,
      content: 'Enter the managed volume name, then the host path.\nEnter submits. Esc cancels.',
    });

    const close = (): void => {
      overlay.destroy();
      if (this.activeTab === 'volumes') {
        this.volumesList.focus();
      }
      this.screen.render();
    };

    const submit = async (): Promise<void> => {
      const name = nameInput.getValue().trim();
      const hostPath = pathInput.getValue().trim();

      if (!name || !hostPath) {
        help.setContent('{red-fg}Name and host path are required.{/red-fg}');
        this.screen.render();
        return;
      }

      help.setContent('Creating Docker volume and persisting Dillinger config…');
      this.screen.render();

      try {
        const result = await createManagedBindVolume(name, hostPath);
        close();
        await this.refresh(false);
        this.setStatus(
          `Managed volume ${result.volume.dockerVolumeName} ready (${result.dockerVolumeCreated ? 'created' : 'linked'}, ${result.persistedVia}).`,
        );
      } catch (error) {
        help.setContent(`{red-fg}${error instanceof Error ? error.message : String(error)}{/red-fg}`);
        this.screen.render();
      }
    };

    this.bindEscapeToClose([overlay, nameInput, pathInput], close);
    nameInput.key('enter', () => pathInput.focus());
    pathInput.key('enter', () => {
      void submit();
    });

    nameInput.focus();
    this.screen.render();
  }

  private async openVolumeManagementDialog(): Promise<void> {
    const selected = this.snapshot.dockerVolumes[this.selectedVolumeIndex];
    if (!selected) {
      this.setStatus('No Docker volume selected.');
      return;
    }

    if (!selected.hostPath) {
      this.setStatus('This volume is not bind-backed, so there is no host path to adopt.');
      return;
    }
    const hostPath = selected.hostPath;

    const managed = this.snapshot.managedVolumes.find((volume) => volume.dockerVolumeName === selected.name);
    const overlay = this.createModalOverlay(managed ? ' Edit Managed Volume ' : ' Adopt Existing Volume ', 78, 20);

    const defaultName = managed?.name ?? selected.name.replace(/^dillinger_/, '').replace(/_/g, ' ');

    blessed.text({ parent: overlay, top: 1, left: 0, content: 'Managed name' });
    const nameInput = this.createModalTextbox(overlay, 2, defaultName);

    blessed.text({ parent: overlay, top: 4, left: 0, content: 'Friendly label (optional)' });
    const friendlyNameInput = this.createModalTextbox(overlay, 5, managed?.friendlyName ?? '');

    blessed.text({ parent: overlay, top: 7, left: 0, content: 'Storage tag: blank | ssd | platter | archive' });
    const storageTypeInput = this.createModalTextbox(overlay, 8, managed?.storageType ?? '');

    blessed.text({ parent: overlay, top: 10, left: 0, content: 'Special role: blank | roms | cache | installed | downloads | installers | core' });
    const purposeInput = this.createModalTextbox(overlay, 11, managed?.purpose ?? '');

    const help = blessed.box({
      parent: overlay,
      top: 14,
      left: 0,
      width: '100%-2',
      height: 4,
      tags: true,
      content: `Docker volume: ${selected.name}\nHost path: ${selected.hostPath}\nEnter on the last field saves. Esc cancels.`,
    });

    const close = (): void => {
      overlay.destroy();
      this.volumesList.focus();
      this.screen.render();
    };

    const submit = async (): Promise<void> => {
      try {
        const name = nameInput.getValue().trim();
        const friendlyNameValue = friendlyNameInput.getValue().trim();
        const storageTypeValue = storageTypeInput.getValue().trim();
        const purposeValue = purposeInput.getValue().trim();
        const friendlyName = friendlyNameValue ? friendlyNameValue : null;
        const storageType = storageTypeValue ? normalizeStorageType(storageTypeValue) : null;
        const purpose = purposeValue ? normalizePurpose(purposeValue) : null;

        if (!name) {
          throw new Error('Managed name is required.');
        }

        help.setContent('Saving Dillinger volume management…');
        this.screen.render();

        const result = await upsertManagedVolume({
          dockerVolumeName: selected.name,
          hostPath,
          name,
          friendlyName,
          storageType,
          purpose,
          type: 'docker',
        });

        close();
        await this.refresh(false);
        this.setStatus(
          `${result.adopted ? 'Adopted' : 'Updated'} ${selected.name} (${result.persistedVia})${result.volume.purpose ? ` as ${result.volume.purpose}` : ''}.`,
        );
      } catch (error) {
        help.setContent(`{red-fg}${error instanceof Error ? error.message : String(error)}{/red-fg}`);
        this.screen.render();
      }
    };

    this.bindEscapeToClose([overlay, nameInput, friendlyNameInput, storageTypeInput, purposeInput], close);
    nameInput.key('enter', () => friendlyNameInput.focus());
    friendlyNameInput.key('enter', () => storageTypeInput.focus());
    storageTypeInput.key('enter', () => purposeInput.focus());
    purposeInput.key('enter', () => {
      void submit();
    });

    nameInput.focus();
    this.screen.render();
  }

  private async openSearchDialog(): Promise<void> {
    const overlay = this.createModalOverlay(' Search Games ', 60, 8);

    blessed.text({ parent: overlay, top: 1, left: 0, content: 'Search query (blank clears filter)' });
    const input = this.createModalTextbox(overlay, 3, this.query);

    const close = (): void => {
      overlay.destroy();
      if (this.activeTab === 'games') {
        this.gamesList.focus();
      }
      this.screen.render();
    };

    this.bindEscapeToClose([overlay, input], close);
    input.key('enter', () => {
      this.query = input.getValue().trim();
      this.selectedGameIndex = 0;
      close();
      this.renderGames();
      this.renderFooter();
    });

    input.focus();
    this.screen.render();
  }

  private async launchSelectedGame(): Promise<void> {
    const filteredGames = this.getFilteredGames();
    const selectedGame = filteredGames[this.selectedGameIndex];
    if (!selectedGame) {
      this.setStatus('No game selected.');
      return;
    }

    this.setStatus(`Launching ${selectedGame.title}…`);
    try {
      const result = await launchCoreGame(selectedGame.id);
      this.setStatus(`Launch requested for ${selectedGame.title}${result.session?.id ? ` (session ${result.session.id})` : ''}.`);
      await this.refresh(false);
    } catch (error) {
      this.setStatus(`Launch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
