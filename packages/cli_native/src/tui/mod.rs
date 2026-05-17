use std::{io, time::Duration};

use anyhow::Result;
use crossterm::{
    event::{Event, EventStream, KeyCode, KeyModifiers},
    execute,
    terminal::{self, EnterAlternateScreen, LeaveAlternateScreen},
};
use futures::StreamExt;
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::Line,
    widgets::{Block, Borders, Clear, List, ListItem, ListState, Paragraph, Tabs, Wrap},
    Frame, Terminal,
};
use tokio::time::interval;

use crate::utils::{
    config::get_config,
    core_api::{
        get_core_bootstrap_status, get_core_health_status, launch_core_game, list_core_games,
        CoreBootstrapStatus, CoreGame, CoreHealthStatus,
    },
    docker::{get_container_status, list_docker_volumes_detailed, ContainerStatus, DockerVolumeStatus},
    managed_volumes::{
        build_extra_runner_mount_path, create_managed_bind_volume, get_managed_volume_persistence_hint,
        list_managed_volumes, parse_purpose, parse_storage_type, upsert_managed_volume,
        ManagedVolumeRecord, UpsertManagedVolumeInput,
    },
};

// ── Tab ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Tab {
    Dashboard,
    Volumes,
    Games,
}

impl Tab {
    fn index(self) -> usize {
        match self {
            Tab::Dashboard => 0,
            Tab::Volumes => 1,
            Tab::Games => 2,
        }
    }
    fn next(self) -> Tab {
        match self {
            Tab::Dashboard => Tab::Volumes,
            Tab::Volumes => Tab::Games,
            Tab::Games => Tab::Dashboard,
        }
    }
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

#[derive(Debug, Default)]
struct Snapshot {
    container: Option<ContainerStatus>,
    bootstrap: Option<CoreBootstrapStatus>,
    health: Option<CoreHealthStatus>,
    games: Vec<CoreGame>,
    managed_volumes: Vec<ManagedVolumeRecord>,
    docker_volumes: Vec<DockerVolumeStatus>,
    persistence_hint: String,
}

// ── Modal ─────────────────────────────────────────────────────────────────────

#[derive(Debug)]
enum Modal {
    None,
    CreateVolume {
        name: String,
        path: String,
        focus: u8,
        error: Option<String>,
        working: bool,
    },
    EditVolume {
        docker_vol_name: String,
        host_path: String,
        name: String,
        friendly_name: String,
        storage_type: String,
        purpose: String,
        focus: u8,
        error: Option<String>,
        working: bool,
    },
    SearchGames {
        input: String,
    },
}

// ── Actions (to avoid holding borrows while calling async fns) ───────────────

enum PendingAction {
    None,
    SubmitCreateVolume { name: String, path: String },
    SubmitEditVolume {
        docker_vol_name: String,
        host_path: String,
        name: String,
        friendly_name: String,
        storage_type: String,
        purpose: String,
    },
    CloseSearchGames { query: String },
    LaunchGame { game_id: String, game_title: String },
}

// ── App ───────────────────────────────────────────────────────────────────────

struct App {
    tab: Tab,
    snapshot: Snapshot,
    volume_state: ListState,
    game_state: ListState,
    query: String,
    modal: Modal,
    status_msg: String,
}

impl App {
    fn new() -> Self {
        let mut volume_state = ListState::default();
        volume_state.select(Some(0));
        let mut game_state = ListState::default();
        game_state.select(Some(0));
        Self {
            tab: Tab::Dashboard,
            snapshot: Snapshot::default(),
            volume_state,
            game_state,
            query: String::new(),
            modal: Modal::None,
            status_msg: String::new(),
        }
    }

    async fn refresh(&mut self) {
        let config = get_config();
        let container_name = config.container_name.clone();

        let (container, bootstrap, health, games, managed_volumes, docker_volumes, hint) =
            tokio::join!(
                async { get_container_status(&container_name).await.ok() },
                async { get_core_bootstrap_status().await.ok() },
                async { get_core_health_status().await.ok() },
                async { list_core_games().await.unwrap_or_default() },
                async { list_managed_volumes().await.unwrap_or_default() },
                async { list_docker_volumes_detailed().await.unwrap_or_default() },
                async {
                    get_managed_volume_persistence_hint()
                        .await
                        .unwrap_or_else(|_| "Unable to determine persistence mode.".to_string())
                },
            );

        // Clamp selection indices.
        let max_vol = docker_volumes.len().saturating_sub(1);
        if let Some(i) = self.volume_state.selected() {
            self.volume_state.select(Some(i.min(max_vol)));
        }

        self.snapshot = Snapshot {
            container,
            bootstrap,
            health,
            games,
            managed_volumes,
            docker_volumes,
            persistence_hint: hint,
        };

        let filtered_len = self.filtered_games().len().saturating_sub(1);
        if let Some(i) = self.game_state.selected() {
            self.game_state.select(Some(i.min(filtered_len)));
        }

        self.status_msg = "Refreshed.".to_string();
    }

    fn filtered_games(&self) -> Vec<&CoreGame> {
        let q = self.query.trim().to_lowercase();
        if q.is_empty() {
            return self.snapshot.games.iter().collect();
        }
        self.snapshot
            .games
            .iter()
            .filter(|g| {
                let haystack = [
                    g.title.as_str(),
                    g.slug.as_deref().unwrap_or(""),
                    g.id.as_str(),
                    g.default_platform_id.as_deref().unwrap_or(""),
                    g.platform_id.as_deref().unwrap_or(""),
                ]
                .join(" ")
                .to_lowercase();
                haystack.contains(&q)
            })
            .collect()
    }

    /// Process key event, returning an action that may need async execution.
    /// All sync state mutations happen here to avoid borrow issues.
    fn process_event(&mut self, event: &Event) -> Result<(PendingAction, bool)> {
        let key = match event {
            Event::Key(k) => k,
            _ => return Ok((PendingAction::None, false)),
        };

        // Modal handling takes priority.
        match &mut self.modal {
            Modal::None => {}
            Modal::SearchGames { input } => {
                match key.code {
                    KeyCode::Esc => {
                        self.modal = Modal::None;
                    }
                    KeyCode::Enter => {
                        let q = input.trim().to_string();
                        return Ok((PendingAction::CloseSearchGames { query: q }, false));
                    }
                    KeyCode::Backspace => {
                        input.pop();
                    }
                    KeyCode::Char(c) => {
                        input.push(c);
                    }
                    _ => {}
                }
                return Ok((PendingAction::None, false));
            }
            Modal::CreateVolume { name, path, focus, error, working } => {
                if *working {
                    return Ok((PendingAction::None, false));
                }
                match key.code {
                    KeyCode::Esc => {
                        self.modal = Modal::None;
                    }
                    KeyCode::Tab | KeyCode::Enter if *focus == 0 => {
                        *focus = 1;
                    }
                    KeyCode::Enter if *focus == 1 => {
                        let n = name.trim().to_string();
                        let p = path.trim().to_string();
                        if n.is_empty() || p.is_empty() {
                            *error = Some("Name and host path are required.".to_string());
                        } else {
                            *working = true;
                            return Ok((
                                PendingAction::SubmitCreateVolume { name: n, path: p },
                                false,
                            ));
                        }
                    }
                    KeyCode::Backspace => {
                        if *focus == 0 { name.pop(); } else { path.pop(); }
                        *error = None;
                    }
                    KeyCode::Char(c) => {
                        if *focus == 0 { name.push(c); } else { path.push(c); }
                        *error = None;
                    }
                    _ => {}
                }
                return Ok((PendingAction::None, false));
            }
            Modal::EditVolume {
                docker_vol_name, host_path, name, friendly_name,
                storage_type, purpose, focus, error, working,
            } => {
                if *working {
                    return Ok((PendingAction::None, false));
                }
                match key.code {
                    KeyCode::Esc => {
                        self.modal = Modal::None;
                    }
                    KeyCode::Tab | KeyCode::Enter if *focus < 3 => {
                        *focus += 1;
                    }
                    KeyCode::Enter if *focus == 3 => {
                        if name.trim().is_empty() {
                            *error = Some("Managed name is required.".to_string());
                        } else {
                            *working = true;
                            return Ok((
                                PendingAction::SubmitEditVolume {
                                    docker_vol_name: docker_vol_name.clone(),
                                    host_path: host_path.clone(),
                                    name: name.trim().to_string(),
                                    friendly_name: friendly_name.trim().to_string(),
                                    storage_type: storage_type.trim().to_string(),
                                    purpose: purpose.trim().to_string(),
                                },
                                false,
                            ));
                        }
                    }
                    KeyCode::Backspace => {
                        match *focus {
                            0 => { name.pop(); }
                            1 => { friendly_name.pop(); }
                            2 => { storage_type.pop(); }
                            3 => { purpose.pop(); }
                            _ => {}
                        }
                        *error = None;
                    }
                    KeyCode::Char(c) => {
                        match *focus {
                            0 => name.push(c),
                            1 => friendly_name.push(c),
                            2 => storage_type.push(c),
                            3 => purpose.push(c),
                            _ => {}
                        }
                        *error = None;
                    }
                    _ => {}
                }
                return Ok((PendingAction::None, false));
            }
        }

        // Main key handling (no modal open).
        match key.code {
            KeyCode::Char('q') => return Ok((PendingAction::None, true)),
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                return Ok((PendingAction::None, true));
            }
            KeyCode::Char('1') => self.tab = Tab::Dashboard,
            KeyCode::Char('2') => self.tab = Tab::Volumes,
            KeyCode::Char('3') => self.tab = Tab::Games,
            KeyCode::Tab => self.tab = self.tab.next(),
            KeyCode::Up => self.move_selection(-1),
            KeyCode::Down => self.move_selection(1),
            KeyCode::Char('c') if self.tab == Tab::Volumes => {
                self.modal = Modal::CreateVolume {
                    name: String::new(),
                    path: String::new(),
                    focus: 0,
                    error: None,
                    working: false,
                };
            }
            KeyCode::Char('/') if self.tab == Tab::Games => {
                self.modal = Modal::SearchGames { input: self.query.clone() };
            }
            KeyCode::Enter => {
                if self.tab == Tab::Volumes {
                    self.open_edit_volume_modal();
                } else if self.tab == Tab::Games {
                    let games = self.filtered_games();
                    let idx = self.game_state.selected().unwrap_or(0);
                    if let Some(game) = games.get(idx) {
                        let id = game.id.clone();
                        let title = game.title.clone();
                        return Ok((PendingAction::LaunchGame { game_id: id, game_title: title }, false));
                    }
                }
            }
            _ => {}
        }

        Ok((PendingAction::None, false))
    }

    fn move_selection(&mut self, delta: i32) {
        match self.tab {
            Tab::Volumes => {
                let max = self.snapshot.docker_volumes.len().saturating_sub(1);
                let i = self.volume_state.selected().unwrap_or(0) as i32;
                let new_i = (i + delta).clamp(0, max as i32) as usize;
                self.volume_state.select(Some(new_i));
            }
            Tab::Games => {
                let max = self.filtered_games().len().saturating_sub(1);
                let i = self.game_state.selected().unwrap_or(0) as i32;
                let new_i = (i + delta).clamp(0, max as i32) as usize;
                self.game_state.select(Some(new_i));
            }
            _ => {}
        }
    }

    fn open_edit_volume_modal(&mut self) {
        let idx = self.volume_state.selected().unwrap_or(0);
        let vol = match self.snapshot.docker_volumes.get(idx).cloned() {
            Some(v) => v,
            None => return,
        };
        if vol.host_path.is_none() {
            self.status_msg =
                "This volume is not bind-backed, so there is no host path to adopt.".to_string();
            return;
        }
        let host_path = vol.host_path.clone().unwrap_or_default();
        let managed = self
            .snapshot
            .managed_volumes
            .iter()
            .find(|m| m.docker_volume_name == vol.name)
            .cloned();
        let default_name = managed
            .as_ref()
            .map(|m| m.name.clone())
            .unwrap_or_else(|| vol.name.replace("dillinger_", "").replace('_', " "));

        self.modal = Modal::EditVolume {
            docker_vol_name: vol.name.clone(),
            host_path,
            name: default_name,
            friendly_name: managed.as_ref().and_then(|m| m.friendly_name.clone()).unwrap_or_default(),
            storage_type: managed
                .as_ref()
                .and_then(|m| m.storage_type.as_ref())
                .map(|s| s.as_str().to_string())
                .unwrap_or_default(),
            purpose: managed
                .as_ref()
                .and_then(|m| m.purpose.as_ref())
                .map(|p| p.as_str().to_string())
                .unwrap_or_default(),
            focus: 0,
            error: None,
            working: false,
        };
    }

    async fn execute_action(&mut self, action: PendingAction) {
        match action {
            PendingAction::None => {}
            PendingAction::CloseSearchGames { query } => {
                self.query = query;
                self.game_state.select(Some(0));
                self.modal = Modal::None;
            }
            PendingAction::LaunchGame { game_id, game_title } => {
                self.status_msg = format!("Launching {}…", game_title);
                match launch_core_game(&game_id).await {
                    Ok(r) => {
                        let suffix = r
                            .session_id
                            .map(|id| format!(" (session {})", id))
                            .unwrap_or_default();
                        self.status_msg = format!("Launch requested for {}{}", game_title, suffix);
                    }
                    Err(e) => {
                        self.status_msg = format!("Launch failed: {}", e);
                    }
                }
                self.refresh().await;
            }
            PendingAction::SubmitCreateVolume { name, path } => {
                match create_managed_bind_volume(&name, &path).await {
                    Ok(result) => {
                        self.status_msg = format!(
                            "Managed volume {} ready ({}, {}).",
                            result.volume.docker_volume_name,
                            if result.docker_volume_created { "created" } else { "linked" },
                            result.persisted_via
                        );
                        self.modal = Modal::None;
                        self.refresh().await;
                    }
                    Err(e) => {
                        if let Modal::CreateVolume { error, working, .. } = &mut self.modal {
                            *error = Some(e.to_string());
                            *working = false;
                        }
                    }
                }
            }
            PendingAction::SubmitEditVolume {
                docker_vol_name, host_path, name, friendly_name, storage_type, purpose,
            } => {
                let storage = match parse_storage_type(&storage_type) {
                    Ok(v) => v,
                    Err(e) => {
                        if let Modal::EditVolume { error, working, .. } = &mut self.modal {
                            *error = Some(e.to_string());
                            *working = false;
                        }
                        return;
                    }
                };
                let purp = match parse_purpose(&purpose) {
                    Ok(v) => v,
                    Err(e) => {
                        if let Modal::EditVolume { error, working, .. } = &mut self.modal {
                            *error = Some(e.to_string());
                            *working = false;
                        }
                        return;
                    }
                };

                let input = UpsertManagedVolumeInput {
                    docker_volume_name: docker_vol_name,
                    host_path,
                    name,
                    friendly_name: if friendly_name.is_empty() { None } else { Some(friendly_name) },
                    storage_type: storage,
                    purpose: purp,
                    volume_type: Some("docker".to_string()),
                };

                match upsert_managed_volume(input).await {
                    Ok(result) => {
                        let purpose_str = result
                            .volume
                            .purpose
                            .as_ref()
                            .map(|p| format!(" as {}", p.as_str()))
                            .unwrap_or_default();
                        self.status_msg = format!(
                            "{} {} ({}){}.",
                            if result.adopted { "Adopted" } else { "Updated" },
                            result.volume.docker_volume_name,
                            result.persisted_via,
                            purpose_str
                        );
                        self.modal = Modal::None;
                        self.refresh().await;
                    }
                    Err(e) => {
                        if let Modal::EditVolume { error, working, .. } = &mut self.modal {
                            *error = Some(e.to_string());
                            *working = false;
                        }
                    }
                }
            }
        }
    }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

fn ui(frame: &mut Frame, app: &mut App) {
    let size = frame.size();

    // Top-level vertical layout.
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2), // header
            Constraint::Length(1), // tab bar
            Constraint::Min(0),    // content
            Constraint::Length(1), // footer / status
        ])
        .split(size);

    render_header(frame, chunks[0], app);
    render_tab_bar(frame, chunks[1], app);

    match app.tab {
        Tab::Dashboard => render_dashboard(frame, chunks[2], app),
        Tab::Volumes => render_volumes(frame, chunks[2], app),
        Tab::Games => render_games(frame, chunks[2], app),
    }

    render_footer(frame, chunks[3], app);
    render_modal(frame, size, app);
}

fn render_header(frame: &mut Frame, area: Rect, app: &App) {
    let runtime_label = if app.snapshot.container.as_ref().map(|c| c.running).unwrap_or(false) {
        "container"
    } else {
        "stopped"
    };
    let game_count = app
        .snapshot
        .health
        .as_ref()
        .and_then(|h| h.counts.as_ref())
        .and_then(|c| c.games)
        .unwrap_or(app.snapshot.games.len() as u64);
    let port = get_config().port;

    let text = format!(
        "Dillinger Gaming  runtime={}  core={}  games={}  managed-volumes={}",
        runtime_label,
        port,
        game_count,
        app.snapshot.managed_volumes.len()
    );
    let header = Paragraph::new(text)
        .style(Style::default().fg(Color::White).bg(Color::Blue))
        .block(Block::default());
    frame.render_widget(header, area);
}

fn render_tab_bar(frame: &mut Frame, area: Rect, app: &App) {
    let titles = vec![
        Line::from("1 Dashboard"),
        Line::from("2 Volumes"),
        Line::from("3 Games"),
    ];
    let tabs = Tabs::new(titles)
        .select(app.tab.index())
        .style(Style::default().fg(Color::White))
        .highlight_style(
            Style::default()
                .fg(Color::Black)
                .bg(Color::Green)
                .add_modifier(Modifier::BOLD),
        )
        .divider("|");
    frame.render_widget(tabs, area);
}

fn render_footer(frame: &mut Frame, area: Rect, app: &App) {
    let text = if !app.status_msg.is_empty() {
        app.status_msg.clone()
    } else {
        match app.tab {
            Tab::Dashboard => "Dashboard: runtime status, counts, persistence hints.".to_string(),
            Tab::Volumes => "Volumes: c create  Enter adopt/edit  r refresh".to_string(),
            Tab::Games => format!(
                "Games: / search ({})  Enter launch  r refresh",
                if app.query.is_empty() { "all" } else { &app.query }
            ),
        }
    };
    let footer = Paragraph::new(text).style(Style::default().fg(Color::White));
    frame.render_widget(footer, area);
}

fn render_dashboard(frame: &mut Frame, area: Rect, app: &App) {
    let container = app.snapshot.container.as_ref();
    let bootstrap = app.snapshot.bootstrap.as_ref();
    let health = app.snapshot.health.as_ref();

    let running_info = if container.map(|c| c.running).unwrap_or(false) {
        format!(
            "{} ({})",
            container.and_then(|c| c.image.as_deref()).unwrap_or("unknown"),
            container.and_then(|c| c.status.as_deref()).unwrap_or("running")
        )
    } else {
        "not running".to_string()
    };

    let lines = vec![
        format!("Runtime"),
        format!("- Container core: {}", running_info),
        format!(
            "- Core API: {}",
            bootstrap
                .map(|b| format!("reachable ({})", b.runtime))
                .unwrap_or_else(|| "unreachable".to_string())
        ),
        format!(
            "- Started: {}",
            container.and_then(|c| c.uptime.as_deref()).unwrap_or("n/a")
        ),
        format!(
            "- Data path: {}",
            bootstrap
                .and_then(|b| b.host_data_path.as_deref().or(Some(b.dillinger_core_path.as_str())))
                .unwrap_or("n/a")
        ),
        String::new(),
        format!("Counts"),
        format!(
            "- Games: {}",
            health.and_then(|h| h.counts.as_ref()).and_then(|c| c.games).unwrap_or(app.snapshot.games.len() as u64)
        ),
        format!(
            "- Platforms: {}",
            health.and_then(|h| h.counts.as_ref()).and_then(|c| c.platforms).map(|n| n.to_string()).unwrap_or_else(|| "n/a".to_string())
        ),
        format!(
            "- Sessions: {}",
            health.and_then(|h| h.counts.as_ref()).and_then(|c| c.sessions).map(|n| n.to_string()).unwrap_or_else(|| "n/a".to_string())
        ),
        format!(
            "- Collections: {}",
            health.and_then(|h| h.counts.as_ref()).and_then(|c| c.collections).map(|n| n.to_string()).unwrap_or_else(|| "n/a".to_string())
        ),
        String::new(),
        format!("Volumes"),
        format!("- Docker volumes detected: {}", app.snapshot.docker_volumes.len()),
        format!("- Managed extra volumes: {}", app.snapshot.managed_volumes.len()),
        String::new(),
        format!("Persistence"),
        format!(
            "- {}",
            if app.snapshot.persistence_hint.is_empty() {
                "Waiting for storage information..."
            } else {
                &app.snapshot.persistence_hint
            }
        ),
    ];

    let text: Vec<Line> = lines
        .iter()
        .map(|l| Line::from(l.as_str()))
        .collect();

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title(" Dashboard "))
        .wrap(Wrap { trim: false });
    frame.render_widget(paragraph, area);
}

fn render_volumes(frame: &mut Frame, area: Rect, app: &mut App) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    // Volume list (left pane).
    let managed_names: std::collections::HashSet<&str> = app
        .snapshot
        .managed_volumes
        .iter()
        .map(|m| m.docker_volume_name.as_str())
        .collect();

    let items: Vec<ListItem> = app
        .snapshot
        .docker_volumes
        .iter()
        .map(|v| {
            let managed_tag = if managed_names.contains(v.name.as_str()) { "[managed] " } else { "" };
            let bind_tag = if v.is_bind { "[bind] " } else { "" };
            let label = format!("{}{}{}", managed_tag, bind_tag, truncate(&v.name, 36));
            ListItem::new(label)
        })
        .collect();

    let list = if items.is_empty() {
        List::new(vec![ListItem::new("No Docker volumes found")])
            .block(Block::default().borders(Borders::ALL).title(" Volumes "))
    } else {
        List::new(items)
            .block(Block::default().borders(Borders::ALL).title(" Volumes "))
            .highlight_style(Style::default().fg(Color::Black).bg(Color::Green))
    };
    frame.render_stateful_widget(list, chunks[0], &mut app.volume_state);

    // Volume details (right pane).
    let idx = app.volume_state.selected().unwrap_or(0);
    let detail_text = if let Some(vol) = app.snapshot.docker_volumes.get(idx) {
        let managed = app
            .snapshot
            .managed_volumes
            .iter()
            .find(|m| m.docker_volume_name == vol.name);

        let mut lines = vec![
            format!("{}", vol.name),
            String::new(),
            format!("Driver: {}", vol.driver),
            format!("Bind-backed: {}", if vol.is_bind { "yes" } else { "no" }),
            format!("Host path: {}", vol.host_path.as_deref().unwrap_or("n/a")),
            format!("Docker mountpoint: {}", if vol.mountpoint.is_empty() { "n/a" } else { &vol.mountpoint }),
            format!("Runner mount path: {}", build_extra_runner_mount_path(&vol.name)),
            String::new(),
            format!("Managed by Dillinger: {}", if managed.is_some() { "yes" } else { "no" }),
        ];
        if let Some(m) = managed {
            lines.extend([
                String::new(),
                "Managed config".to_string(),
                format!("Name: {}", m.name),
                format!("Stored host path: {}", m.host_path),
                format!("Status: {}", m.status),
                format!("Friendly label: {}", m.friendly_name.as_deref().unwrap_or("n/a")),
                format!("Storage tag: {}", m.storage_type.as_ref().map(|s| s.as_str()).unwrap_or("n/a")),
                format!("Special role: {}", m.purpose.as_ref().map(|p| p.as_str()).unwrap_or("general")),
                format!("Created: {}", m.created_at),
            ]);
        }
        lines.extend([
            String::new(),
            "Press Enter to adopt/edit this volume, or c to create a new bind-backed volume.".to_string(),
        ]);
        lines.join("\n")
    } else {
        "Select a Docker volume to see details.".to_string()
    };

    let detail_spans: Vec<Line> = detail_text
        .lines()
        .map(|l| Line::from(l.to_string()))
        .collect();
    let details = Paragraph::new(detail_spans)
        .block(Block::default().borders(Borders::ALL).title(" Volume Details "))
        .wrap(Wrap { trim: false });
    frame.render_widget(details, chunks[1]);
}

fn render_games(frame: &mut Frame, area: Rect, app: &mut App) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    // Collect all data from the filtered list eagerly so we don't hold a
    // shared borrow on `app` while also mutably borrowing `app.game_state`.
    let total_games = app.snapshot.games.len();
    let idx = app.game_state.selected().unwrap_or(0);

    let (items, title, detail_text): (Vec<ListItem>, String, String) = {
        let filtered = app.filtered_games();
        let title = format!(" Games ({}/{}) ", filtered.len(), total_games);
        let items: Vec<ListItem> = filtered
            .iter()
            .map(|g| {
                let platform = g
                    .default_platform_id
                    .as_deref()
                    .or(g.platform_id.as_deref())
                    .unwrap_or("unknown");
                let plays = g
                    .metadata
                    .as_ref()
                    .and_then(|m| m.play_count)
                    .unwrap_or(0);
                ListItem::new(format!(
                    "{:<37} {:<13} plays={}",
                    truncate(&g.title, 36),
                    truncate(platform, 12),
                    plays
                ))
            })
            .collect();
        let detail_text = if let Some(game) = filtered.get(idx) {
            let platform = game
                .default_platform_id
                .as_deref()
                .or(game.platform_id.as_deref())
                .or(game.platforms.as_ref().and_then(|ps| ps.first().map(|p| p.platform_id.as_str())))
                .unwrap_or("unknown");
            vec![
                game.title.clone(),
                String::new(),
                format!("ID: {}", game.id),
                format!("Slug: {}", game.slug.as_deref().unwrap_or("n/a")),
                format!("Default platform: {}", platform),
                format!(
                    "Play count: {}",
                    game.metadata.as_ref().and_then(|m| m.play_count).unwrap_or(0)
                ),
                format!(
                    "Last played: {}",
                    game.metadata.as_ref().and_then(|m| m.last_played.as_deref()).unwrap_or("n/a")
                ),
                String::new(),
                "Launch".to_string(),
                "Press Enter to launch this game through the running Dillinger Core.".to_string(),
            ]
            .join("\n")
        } else {
            "Select a game to inspect and launch.".to_string()
        };
        (items, title, detail_text)
    };

    let list = if items.is_empty() {
        List::new(vec![ListItem::new("No games match the current search.")])
            .block(Block::default().borders(Borders::ALL).title(title))
    } else {
        List::new(items)
            .block(Block::default().borders(Borders::ALL).title(title))
            .highlight_style(Style::default().fg(Color::Black).bg(Color::Green))
    };
    frame.render_stateful_widget(list, chunks[0], &mut app.game_state);

    let detail_spans: Vec<Line> = detail_text
        .lines()
        .map(|l| Line::from(l.to_string()))
        .collect();
    let details = Paragraph::new(detail_spans)
        .block(Block::default().borders(Borders::ALL).title(" Game Details "))
        .wrap(Wrap { trim: false });
    frame.render_widget(details, chunks[1]);
}

fn render_modal(frame: &mut Frame, area: Rect, app: &App) {
    match &app.modal {
        Modal::None => {}
        Modal::CreateVolume { name, path, focus, error, working } => {
            let modal_area = centered_rect(60, 12, area);
            frame.render_widget(Clear, modal_area);
            let block = Block::default()
                .borders(Borders::ALL)
                .title(" Create Managed Volume ")
                .style(Style::default().fg(Color::Cyan));
            frame.render_widget(block, modal_area);

            let inner = shrink(modal_area, 1);
            let rows = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Min(0),
                ])
                .split(inner);

            let label_style = Style::default().fg(Color::Yellow);
            frame.render_widget(Paragraph::new("Name:").style(label_style), rows[0]);
            frame.render_widget(
                Paragraph::new(name.as_str()).style(field_style(*focus == 0)),
                rows[1],
            );
            frame.render_widget(Paragraph::new("Host path:").style(label_style), rows[2]);
            frame.render_widget(
                Paragraph::new(path.as_str()).style(field_style(*focus == 1)),
                rows[3],
            );

            let hint = if *working {
                "Creating Docker volume and persisting Dillinger config…".to_string()
            } else if let Some(e) = error {
                format!("Error: {}", e)
            } else {
                "Tab/Enter moves to next field. Enter on path submits. Esc cancels.".to_string()
            };
            frame.render_widget(Paragraph::new(hint).style(Style::default().fg(Color::Gray)), rows[4]);
        }
        Modal::EditVolume {
            docker_vol_name, host_path, name, friendly_name, storage_type, purpose,
            focus, error, working,
        } => {
            let modal_area = centered_rect(66, 16, area);
            frame.render_widget(Clear, modal_area);
            let title = " Adopt / Edit Managed Volume ";
            let block = Block::default()
                .borders(Borders::ALL)
                .title(title)
                .style(Style::default().fg(Color::Cyan));
            frame.render_widget(block, modal_area);

            let inner = shrink(modal_area, 1);
            let rows = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Min(0),
                ])
                .split(inner);

            let label_style = Style::default().fg(Color::Yellow);
            frame.render_widget(Paragraph::new("Managed name:").style(label_style), rows[0]);
            frame.render_widget(Paragraph::new(name.as_str()).style(field_style(*focus == 0)), rows[1]);
            frame.render_widget(Paragraph::new("Friendly label (optional):").style(label_style), rows[2]);
            frame.render_widget(Paragraph::new(friendly_name.as_str()).style(field_style(*focus == 1)), rows[3]);
            frame.render_widget(Paragraph::new("Storage tag: blank | ssd | platter | archive").style(label_style), rows[4]);
            frame.render_widget(Paragraph::new(storage_type.as_str()).style(field_style(*focus == 2)), rows[5]);
            frame.render_widget(Paragraph::new("Special role: blank | roms | cache | installed | downloads | installers").style(label_style), rows[6]);
            frame.render_widget(Paragraph::new(purpose.as_str()).style(field_style(*focus == 3)), rows[7]);

            let hint = if *working {
                "Saving Dillinger volume management…".to_string()
            } else if let Some(e) = error {
                format!("Error: {}", e)
            } else {
                format!("Volume: {}  Host: {}  Enter on last field saves. Esc cancels.", docker_vol_name, host_path)
            };
            frame.render_widget(Paragraph::new(hint).style(Style::default().fg(Color::Gray)).wrap(Wrap { trim: true }), rows[8]);
        }
        Modal::SearchGames { input } => {
            let modal_area = centered_rect(50, 6, area);
            frame.render_widget(Clear, modal_area);
            let block = Block::default()
                .borders(Borders::ALL)
                .title(" Search Games ")
                .style(Style::default().fg(Color::Cyan));
            frame.render_widget(block, modal_area);

            let inner = shrink(modal_area, 1);
            let rows = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Length(1), Constraint::Length(1), Constraint::Min(0)])
                .split(inner);

            frame.render_widget(
                Paragraph::new("Search query (blank clears filter):").style(Style::default().fg(Color::Yellow)),
                rows[0],
            );
            frame.render_widget(
                Paragraph::new(input.as_str()).style(field_style(true)),
                rows[1],
            );
            frame.render_widget(
                Paragraph::new("Enter to apply. Esc to cancel.").style(Style::default().fg(Color::Gray)),
                rows[2],
            );
        }
    }
}

fn field_style(focused: bool) -> Style {
    if focused {
        Style::default().fg(Color::Black).bg(Color::White).add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::White).bg(Color::DarkGray)
    }
}

fn centered_rect(width_percent: u16, height_lines: u16, r: Rect) -> Rect {
    let popup_width = r.width.min(width_percent * r.width / 100);
    let popup_height = r.height.min(height_lines);
    let x = r.x + (r.width.saturating_sub(popup_width)) / 2;
    let y = r.y + (r.height.saturating_sub(popup_height)) / 2;
    Rect::new(x, y, popup_width, popup_height)
}

fn shrink(r: Rect, by: u16) -> Rect {
    Rect::new(
        r.x + by,
        r.y + by,
        r.width.saturating_sub(by * 2),
        r.height.saturating_sub(by * 2),
    )
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let mut t: String = s.chars().take(max.saturating_sub(1)).collect();
        t.push('…');
        t
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub async fn run() -> Result<()> {
    terminal::enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let result = run_app(&mut terminal).await;

    terminal::disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    result
}

async fn run_app(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    let mut app = App::new();
    let mut event_stream = EventStream::new();
    let mut refresh_tick = interval(Duration::from_secs(8));

    // Initial data load.
    app.status_msg = "Loading…".to_string();
    app.refresh().await;

    loop {
        terminal.draw(|f| ui(f, &mut app))?;

        tokio::select! {
            _ = refresh_tick.tick() => {
                app.refresh().await;
            }
            maybe_event = event_stream.next() => {
                match maybe_event {
                    Some(Ok(event)) => {
                        let (action, should_quit) = app.process_event(&event)?;
                        if should_quit {
                            break;
                        }
                        // Refresh key 'r' handled inline in process_event via the action mechanism.
                        if matches!(event, Event::Key(k) if k.code == KeyCode::Char('r')
                            && matches!(app.modal, Modal::None))
                        {
                            app.status_msg = "Refreshing…".to_string();
                            app.refresh().await;
                        } else {
                            app.execute_action(action).await;
                        }
                    }
                    Some(Err(_)) | None => break,
                }
            }
        }
    }

    Ok(())
}
