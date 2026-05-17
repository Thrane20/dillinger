use std::{io, process::Stdio, time::Duration};

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
use tokio::{process::Command as DockerCmd, time::interval};

use crate::utils::{
    config::get_config,
    constants::{
        DEFAULT_DOWNLOAD_CACHE_VOLUME_NAME, DEFAULT_ROMS_VOLUME_NAME, DEFAULT_VOLUME_NAME,
        INSTALLED_VOLUME_PREFIX,
    },
    core_api::{
        get_core_bootstrap_status, get_core_health_status, launch_core_game, list_core_games,
        CoreBootstrapStatus, CoreGame, CoreHealthStatus,
    },
    docker::{
        get_container_status, list_docker_volumes_detailed, ContainerStatus, DockerVolumeStatus,
    },
    managed_volumes::{
        build_extra_runner_mount_path, create_managed_bind_volume,
        get_managed_volume_persistence_hint, list_managed_volumes, parse_purpose,
        parse_storage_type, upsert_managed_volume, ManagedVolumePurpose, ManagedVolumeRecord,
        UpsertManagedVolumeInput,
    },
    volume::list_volumes,
};

// ── Tab ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Tab {
    Dashboard,
    Volumes,
    Games,
    Logs,
}

impl Tab {
    fn index(self) -> usize {
        match self {
            Tab::Dashboard => 0,
            Tab::Volumes => 1,
            Tab::Games => 2,
            Tab::Logs => 3,
        }
    }
    fn next(self) -> Tab {
        match self {
            Tab::Dashboard => Tab::Volumes,
            Tab::Volumes => Tab::Games,
            Tab::Games => Tab::Logs,
            Tab::Logs => Tab::Dashboard,
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
    live_docker_volume_names: std::collections::HashSet<String>,
    persistence_hint: String,
    log_lines: Vec<String>,
}

#[derive(Debug, Clone)]
enum VolumeListEntry {
    Managed {
        managed: ManagedVolumeRecord,
        live: bool,
        docker: Option<DockerVolumeStatus>,
    },
    DockerOnly(DockerVolumeStatus),
}

fn build_volume_entries(snapshot: &Snapshot) -> Vec<VolumeListEntry> {
    let docker_by_name: std::collections::HashMap<&str, &DockerVolumeStatus> = snapshot
        .docker_volumes
        .iter()
        .map(|docker| (docker.name.as_str(), docker))
        .collect();

    let managed_names: std::collections::HashSet<&str> = snapshot
        .managed_volumes
        .iter()
        .map(|managed| managed.docker_volume_name.as_str())
        .collect();

    let mut entries =
        Vec::with_capacity(snapshot.managed_volumes.len() + snapshot.docker_volumes.len());

    for managed in &snapshot.managed_volumes {
        entries.push(VolumeListEntry::Managed {
            managed: managed.clone(),
            live: snapshot
                .live_docker_volume_names
                .contains(managed.docker_volume_name.as_str()),
            docker: docker_by_name
                .get(managed.docker_volume_name.as_str())
                .map(|docker| (*docker).clone()),
        });
    }

    for docker in &snapshot.docker_volumes {
        if !managed_names.contains(docker.name.as_str()) {
            entries.push(VolumeListEntry::DockerOnly(docker.clone()));
        }
    }

    entries
}

fn volume_role_label(
    purpose: Option<&ManagedVolumePurpose>,
    docker_volume_name: &str,
) -> &'static str {
    match purpose {
        Some(ManagedVolumePurpose::Core) => "core",
        Some(ManagedVolumePurpose::Roms) => "roms",
        Some(ManagedVolumePurpose::Cache) | Some(ManagedVolumePurpose::Downloads) => {
            "download_cache"
        }
        Some(ManagedVolumePurpose::Installed) => "installed",
        Some(ManagedVolumePurpose::Installers) => "installers",
        None if docker_volume_name == DEFAULT_VOLUME_NAME => "core",
        None if docker_volume_name == DEFAULT_ROMS_VOLUME_NAME => "roms",
        None if docker_volume_name == DEFAULT_DOWNLOAD_CACHE_VOLUME_NAME => "download_cache",
        None if docker_volume_name.starts_with(INSTALLED_VOLUME_PREFIX) => "installed",
        None => "general",
    }
}

fn volume_container_mount_path(volume: &ManagedVolumeRecord) -> String {
    match volume.purpose {
        Some(ManagedVolumePurpose::Core) => "/data".to_string(),
        Some(ManagedVolumePurpose::Roms) => "/roms".to_string(),
        Some(ManagedVolumePurpose::Cache) | Some(ManagedVolumePurpose::Downloads) => {
            "/cache".to_string()
        }
        Some(ManagedVolumePurpose::Installed) => {
            let suffix = volume
                .docker_volume_name
                .strip_prefix(INSTALLED_VOLUME_PREFIX)
                .unwrap_or(volume.name.as_str())
                .trim_matches('_')
                .to_string();
            format!(
                "/installed/{}",
                if suffix.is_empty() {
                    "default"
                } else {
                    &suffix
                }
            )
        }
        _ if volume.docker_volume_name == DEFAULT_VOLUME_NAME => "/data".to_string(),
        _ if volume.docker_volume_name == DEFAULT_ROMS_VOLUME_NAME => "/roms".to_string(),
        _ if volume.docker_volume_name == DEFAULT_DOWNLOAD_CACHE_VOLUME_NAME => {
            "/cache".to_string()
        }
        _ if volume
            .docker_volume_name
            .starts_with(INSTALLED_VOLUME_PREFIX) =>
        {
            format!(
                "/installed/{}",
                volume
                    .docker_volume_name
                    .trim_start_matches(INSTALLED_VOLUME_PREFIX)
            )
        }
        _ => build_extra_runner_mount_path(&volume.docker_volume_name),
    }
}

fn docker_container_mount_path(docker_volume_name: &str) -> String {
    if docker_volume_name == DEFAULT_VOLUME_NAME {
        "/data".to_string()
    } else if docker_volume_name == DEFAULT_ROMS_VOLUME_NAME {
        "/roms".to_string()
    } else if docker_volume_name == DEFAULT_DOWNLOAD_CACHE_VOLUME_NAME {
        "/cache".to_string()
    } else if docker_volume_name.starts_with(INSTALLED_VOLUME_PREFIX) {
        format!(
            "/installed/{}",
            docker_volume_name.trim_start_matches(INSTALLED_VOLUME_PREFIX)
        )
    } else {
        build_extra_runner_mount_path(docker_volume_name)
    }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

#[derive(Debug)]
enum Modal {
    None,
    CreateVolume {
        name: String,
        path: String,
        purpose: String,
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
    CommandOutput {
        title: String,
        lines: Vec<String>,
    },
    ConfirmPull {
        local_version: Option<String>,
        remote_version: String,
        image_base: String,
    },
}

// ── Actions (to avoid holding borrows while calling async fns) ───────────────

enum PendingAction {
    None,
    SubmitCreateVolume {
        name: String,
        path: String,
        purpose: String,
    },
    SubmitEditVolume {
        docker_vol_name: String,
        host_path: String,
        name: String,
        friendly_name: String,
        storage_type: String,
        purpose: String,
    },
    CloseSearchGames {
        query: String,
    },
    LaunchGame {
        game_id: String,
        game_title: String,
    },
    StartContainer,
    StopContainer,
    RestartContainer,
    PullAndStart {
        image_ref: String,
    },
    StartLocal {
        image_ref: String,
    },
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
    log_scroll: usize,
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
            log_scroll: 0,
        }
    }

    async fn refresh(&mut self) {
        let config = get_config();
        let container_name = config.container_name.clone();

        let (
            container,
            bootstrap,
            health,
            games,
            managed_volumes,
            docker_volumes,
            live_docker_volume_names,
            hint,
            log_lines,
        ) = tokio::join!(
            async { get_container_status(&container_name).await.ok() },
            async { get_core_bootstrap_status().await.ok() },
            async { get_core_health_status().await.ok() },
            async { list_core_games().await.unwrap_or_default() },
            async { list_managed_volumes().await.unwrap_or_default() },
            async { list_docker_volumes_detailed().await.unwrap_or_default() },
            async {
                list_volumes(None)
                    .await
                    .unwrap_or_default()
                    .into_iter()
                    .collect::<std::collections::HashSet<_>>()
            },
            async {
                get_managed_volume_persistence_hint()
                    .await
                    .unwrap_or_else(|_| "Unable to determine persistence mode.".to_string())
            },
            async { fetch_container_logs(&container_name, 200).await },
        );

        // Clamp selection indices.
        let managed_names: std::collections::HashSet<&str> = managed_volumes
            .iter()
            .map(|managed| managed.docker_volume_name.as_str())
            .collect();
        let volume_entry_len = managed_volumes.len()
            + docker_volumes
                .iter()
                .filter(|docker| !managed_names.contains(docker.name.as_str()))
                .count();
        let max_vol = volume_entry_len.saturating_sub(1);
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
            live_docker_volume_names,
            persistence_hint: hint,
            log_lines,
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
            Modal::CreateVolume {
                name,
                path,
                purpose,
                focus,
                error,
                working,
            } => {
                if *working {
                    return Ok((PendingAction::None, false));
                }
                match key.code {
                    KeyCode::Esc => {
                        self.modal = Modal::None;
                    }
                    KeyCode::Tab | KeyCode::Enter if *focus < 2 => {
                        *focus += 1;
                    }
                    KeyCode::Enter if *focus == 2 => {
                        let n = name.trim().to_string();
                        let p = path.trim().to_string();
                        if n.is_empty() || p.is_empty() {
                            *error = Some("Name and host path are required.".to_string());
                        } else {
                            *working = true;
                            return Ok((
                                PendingAction::SubmitCreateVolume {
                                    name: n,
                                    path: p,
                                    purpose: purpose.trim().to_string(),
                                },
                                false,
                            ));
                        }
                    }
                    KeyCode::Backspace => {
                        match *focus {
                            0 => {
                                name.pop();
                            }
                            1 => {
                                path.pop();
                            }
                            2 => {
                                purpose.pop();
                            }
                            _ => {}
                        }
                        *error = None;
                    }
                    KeyCode::Char(c) => {
                        match *focus {
                            0 => name.push(c),
                            1 => path.push(c),
                            2 => purpose.push(c),
                            _ => {}
                        }
                        *error = None;
                    }
                    _ => {}
                }
                return Ok((PendingAction::None, false));
            }
            Modal::EditVolume {
                docker_vol_name,
                host_path,
                name,
                friendly_name,
                storage_type,
                purpose,
                focus,
                error,
                working,
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
                            0 => {
                                name.pop();
                            }
                            1 => {
                                friendly_name.pop();
                            }
                            2 => {
                                storage_type.pop();
                            }
                            3 => {
                                purpose.pop();
                            }
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
            Modal::ConfirmPull {
                local_version,
                remote_version,
                image_base,
            } => {
                match key.code {
                    KeyCode::Enter | KeyCode::Char('y') => {
                        let image_ref = format!("{}:{}", image_base, remote_version);
                        return Ok((PendingAction::PullAndStart { image_ref }, false));
                    }
                    KeyCode::Char('s') if local_version.is_some() => {
                        let lv = local_version.clone().unwrap();
                        let image_ref = format!("{}:{}", image_base, lv);
                        return Ok((PendingAction::StartLocal { image_ref }, false));
                    }
                    KeyCode::Esc => {
                        self.modal = Modal::None;
                    }
                    _ => {}
                }
                return Ok((PendingAction::None, false));
            }
            Modal::CommandOutput { .. } => {
                match key.code {
                    KeyCode::Esc | KeyCode::Enter | KeyCode::Char('q') => {
                        self.modal = Modal::None;
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
            KeyCode::Char('4') => self.tab = Tab::Logs,
            KeyCode::Tab => self.tab = self.tab.next(),
            KeyCode::Up => self.move_selection(-1),
            KeyCode::Down => self.move_selection(1),
            KeyCode::Char('s') if self.tab == Tab::Dashboard => {
                return Ok((PendingAction::StartContainer, false));
            }
            KeyCode::Char('x') if self.tab == Tab::Dashboard => {
                return Ok((PendingAction::StopContainer, false));
            }
            KeyCode::Char('r') if self.tab == Tab::Dashboard => {
                return Ok((PendingAction::RestartContainer, false));
            }
            KeyCode::Char('c') if self.tab == Tab::Volumes => {
                self.modal = Modal::CreateVolume {
                    name: String::new(),
                    path: String::new(),
                    purpose: String::new(),
                    focus: 0,
                    error: None,
                    working: false,
                };
            }
            KeyCode::Char('/') if self.tab == Tab::Games => {
                self.modal = Modal::SearchGames {
                    input: self.query.clone(),
                };
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
                        return Ok((
                            PendingAction::LaunchGame {
                                game_id: id,
                                game_title: title,
                            },
                            false,
                        ));
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
                let max = build_volume_entries(&self.snapshot).len().saturating_sub(1);
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
            Tab::Logs => {
                let total = self.snapshot.log_lines.len();
                if delta < 0 {
                    self.log_scroll = self.log_scroll.saturating_sub((-delta) as usize);
                } else {
                    self.log_scroll =
                        (self.log_scroll + delta as usize).min(total.saturating_sub(1));
                }
            }
            _ => {}
        }
    }

    fn open_edit_volume_modal(&mut self) {
        let idx = self.volume_state.selected().unwrap_or(0);
        let entry = match build_volume_entries(&self.snapshot).get(idx).cloned() {
            Some(entry) => entry,
            None => return,
        };

        match entry {
            VolumeListEntry::Managed {
                managed, docker, ..
            } => {
                self.modal = Modal::EditVolume {
                    docker_vol_name: managed.docker_volume_name.clone(),
                    host_path: docker
                        .and_then(|docker| docker.host_path)
                        .unwrap_or_else(|| managed.host_path.clone()),
                    name: managed.name.clone(),
                    friendly_name: managed.friendly_name.clone().unwrap_or_default(),
                    storage_type: managed
                        .storage_type
                        .as_ref()
                        .map(|s| s.as_str().to_string())
                        .unwrap_or_default(),
                    purpose: managed
                        .purpose
                        .as_ref()
                        .map(|p| p.as_str().to_string())
                        .unwrap_or_default(),
                    focus: 0,
                    error: None,
                    working: false,
                };
            }
            VolumeListEntry::DockerOnly(vol) => {
                if vol.host_path.is_none() {
                    self.status_msg =
                        "This Docker volume is not bind-backed, so there is no host path to adopt."
                            .to_string();
                    return;
                }

                self.modal = Modal::EditVolume {
                    docker_vol_name: vol.name.clone(),
                    host_path: vol.host_path.unwrap_or_default(),
                    name: vol.name.replace("dillinger_", "").replace('_', " "),
                    friendly_name: String::new(),
                    storage_type: String::new(),
                    purpose: String::new(),
                    focus: 0,
                    error: None,
                    working: false,
                };
            }
        }
    }

    async fn execute_action(&mut self, action: PendingAction) {
        match action {
            PendingAction::None => {}
            PendingAction::CloseSearchGames { query } => {
                self.query = query;
                self.game_state.select(Some(0));
                self.modal = Modal::None;
            }
            PendingAction::LaunchGame {
                game_id,
                game_title,
            } => {
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
            PendingAction::StartContainer => {
                let config = crate::utils::config::get_config();
                let name = config.container_name.clone();
                let image_base = config.image_name.clone();

                match get_container_status(&name).await {
                    Ok(status) if status.running => {
                        self.status_msg = "Container is already running.".to_string();
                    }
                    Ok(status) if status.exists => {
                        // Stopped but exists — just resume.
                        let lines = docker_capture(&["start", &name]).await;
                        self.modal = Modal::CommandOutput {
                            title: " Start Container ".to_string(),
                            lines,
                        };
                    }
                    _ => {
                        // Container doesn't exist — check local vs remote image version.
                        self.status_msg = "Checking image versions\u{2026}".to_string();
                        let (local_result, remote_opt) = tokio::join!(
                            crate::utils::version::get_local_image_version(&image_base),
                            crate::utils::version::fetch_remote_versions(),
                        );
                        let local_ver = local_result.ok().flatten();
                        let remote_ver = remote_opt.map(|r| r.core_version);

                        match (&local_ver, &remote_ver) {
                            // Local is behind remote — offer update.
                            (Some(l), Some(r))
                                if crate::utils::version::compare_versions(l, r) < 0 =>
                            {
                                self.modal = Modal::ConfirmPull {
                                    local_version: Some(l.clone()),
                                    remote_version: r.clone(),
                                    image_base,
                                };
                            }
                            // No local image at all — must pull.
                            (None, Some(r)) => {
                                self.modal = Modal::ConfirmPull {
                                    local_version: None,
                                    remote_version: r.clone(),
                                    image_base,
                                };
                            }
                            // Local is up-to-date (or remote unreachable) — start with local.
                            (Some(l), _) => {
                                let image_ref = format!("{}:{}", image_base, l);
                                let lines = run_container_captured(
                                    &name,
                                    &config.volume_name,
                                    &image_ref,
                                    config.port,
                                )
                                .await;
                                self.modal = Modal::CommandOutput {
                                    title: " Start Container ".to_string(),
                                    lines,
                                };
                            }
                            // No local image and no remote — surface error.
                            (None, None) => {
                                self.modal = Modal::CommandOutput {
                                    title: " Start Container ".to_string(),
                                    lines: vec![
                                        "No local image found.".to_string(),
                                        "Could not reach remote registry.".to_string(),
                                        format!("Try: docker pull {}:<version>", image_base),
                                    ],
                                };
                            }
                        }
                    }
                }
                self.refresh().await;
            }
            PendingAction::PullAndStart { image_ref } => {
                let config = crate::utils::config::get_config();
                let mut lines = docker_capture(&["pull", &image_ref]).await;
                let run_lines = run_container_captured(
                    &config.container_name,
                    &config.volume_name,
                    &image_ref,
                    config.port,
                )
                .await;
                lines.push("---".to_string());
                lines.extend(run_lines);
                self.modal = Modal::CommandOutput {
                    title: " Pull & Start ".to_string(),
                    lines,
                };
                self.refresh().await;
            }
            PendingAction::StartLocal { image_ref } => {
                let config = crate::utils::config::get_config();
                let lines = run_container_captured(
                    &config.container_name,
                    &config.volume_name,
                    &image_ref,
                    config.port,
                )
                .await;
                self.modal = Modal::CommandOutput {
                    title: " Start Container ".to_string(),
                    lines,
                };
                self.refresh().await;
            }
            PendingAction::StopContainer => {
                let name = crate::utils::config::get_config().container_name.clone();
                let lines = docker_capture(&["stop", &name]).await;
                self.modal = Modal::CommandOutput {
                    title: " Stop Container ".to_string(),
                    lines,
                };
                self.refresh().await;
            }
            PendingAction::RestartContainer => {
                let name = crate::utils::config::get_config().container_name.clone();
                let lines = docker_capture(&["restart", &name]).await;
                self.modal = Modal::CommandOutput {
                    title: " Restart Container ".to_string(),
                    lines,
                };
                self.refresh().await;
            }
            PendingAction::SubmitCreateVolume {
                name,
                path,
                purpose,
            } => {
                let purp = match parse_purpose(&purpose) {
                    Ok(v) => v,
                    Err(e) => {
                        if let Modal::CreateVolume { error, working, .. } = &mut self.modal {
                            *error = Some(e.to_string());
                            *working = false;
                        }
                        return;
                    }
                };

                match create_managed_bind_volume(&name, &path, purp).await {
                    Ok(result) => {
                        self.status_msg = format!(
                            "Managed volume {} ready ({}, {}).",
                            result.volume.docker_volume_name,
                            if result.docker_volume_created {
                                "created"
                            } else {
                                "linked"
                            },
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
                docker_vol_name,
                host_path,
                name,
                friendly_name,
                storage_type,
                purpose,
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
                    friendly_name: if friendly_name.is_empty() {
                        None
                    } else {
                        Some(friendly_name)
                    },
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

// ── Docker capture helper ─────────────────────────────────────────────────────

/// Fetch the last `tail` lines of docker container logs with captured output.
async fn fetch_container_logs(container_name: &str, tail: usize) -> Vec<String> {
    let tail_str = tail.to_string();
    match DockerCmd::new("docker")
        .args(["logs", "--tail", &tail_str, "--timestamps", container_name])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
    {
        Ok(out) => {
            // docker logs writes to stderr by default; merge both streams
            let mut lines: Vec<String> = String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter(|l| !l.is_empty())
                .map(|l| l.to_string())
                .collect();
            for l in String::from_utf8_lossy(&out.stderr)
                .lines()
                .filter(|l| !l.is_empty())
            {
                lines.push(l.to_string());
            }
            if lines.is_empty() {
                lines.push("(no log output)".to_string());
            }
            lines
        }
        Err(e) => vec![format!("Error fetching logs: {}", e)],
    }
}

/// Run a docker sub-command with captured stdout/stderr so nothing leaks to the
/// TUI's terminal. Returns all non-empty output lines; guarantees at least one
/// line summarising success/failure.
async fn docker_capture(args: &[&str]) -> Vec<String> {
    match DockerCmd::new("docker")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
    {
        Ok(out) => {
            let mut lines: Vec<String> = String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter(|l| !l.is_empty())
                .map(|l| l.to_string())
                .collect();
            for l in String::from_utf8_lossy(&out.stderr)
                .lines()
                .filter(|l| !l.is_empty())
            {
                lines.push(l.to_string());
            }
            if lines.is_empty() {
                lines.push(if out.status.success() {
                    "OK".to_string()
                } else {
                    format!("Exit code {}", out.status.code().unwrap_or(-1))
                });
            }
            lines
        }
        Err(e) => vec![format!("Error running docker: {}", e)],
    }
}

/// Build and run `docker run` with all standard volumes, capturing all output.
/// Used by the TUI so nothing leaks to the terminal during container creation.
async fn run_container_captured(
    container_name: &str,
    volume_name: &str,
    image_ref: &str,
    port: u16,
) -> Vec<String> {
    use crate::commands::start::{
        build_start_docker_args, resolve_configured_mounts, StartOptions,
    };

    let mut lines: Vec<String> = Vec::new();

    let (core_mount_source, extra_volumes) = match resolve_configured_mounts(volume_name).await {
        Ok(mounts) => mounts,
        Err(e) => {
            lines.push(format!("Error preparing configured volumes: {}", e));
            return lines;
        }
    };

    let opts = StartOptions {
        port: Some(port),
        detach: true,
        no_update_check: true,
        gpu: true,
        audio: true,
        display: true,
        input: true,
    };

    let args = build_start_docker_args(
        container_name,
        &core_mount_source,
        image_ref,
        port,
        &opts,
        &extra_volumes,
    );
    let args_str: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    lines.extend(docker_capture(&args_str).await);
    lines
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
            Constraint::Length(2), // footer / status
        ])
        .split(size);

    render_header(frame, chunks[0], app);
    render_tab_bar(frame, chunks[1], app);

    match app.tab {
        Tab::Dashboard => render_dashboard(frame, chunks[2], app),
        Tab::Volumes => render_volumes(frame, chunks[2], app),
        Tab::Games => render_games(frame, chunks[2], app),
        Tab::Logs => render_logs(frame, chunks[2], app),
    }

    render_footer(frame, chunks[3], app);
    render_modal(frame, size, app);
}

fn render_header(frame: &mut Frame, area: Rect, app: &App) {
    let runtime_label = if app
        .snapshot
        .container
        .as_ref()
        .map(|c| c.running)
        .unwrap_or(false)
    {
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
        Line::from("4 Logs"),
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
    let hints = match app.tab {
        Tab::Dashboard => "s start  x stop  r restart".to_string(),
        Tab::Volumes => "c create  Enter adopt/edit  r refresh".to_string(),
        Tab::Games => format!(
            "/ search ({})  Enter launch  r refresh",
            if app.query.is_empty() {
                "all"
            } else {
                &app.query
            }
        ),
        Tab::Logs => "Up/Down scroll  r refresh".to_string(),
    };
    let hint_line = Line::from(hints).style(Style::default().fg(Color::DarkGray));
    let status_line = Line::from(app.status_msg.clone()).style(Style::default().fg(Color::White));
    let footer = Paragraph::new(vec![hint_line, status_line]);
    frame.render_widget(footer, area);
}

fn render_dashboard(frame: &mut Frame, area: Rect, app: &App) {
    let container = app.snapshot.container.as_ref();
    let bootstrap = app.snapshot.bootstrap.as_ref();
    let health = app.snapshot.health.as_ref();

    let running_info = if container.map(|c| c.running).unwrap_or(false) {
        format!(
            "{} ({})",
            container
                .and_then(|c| c.image.as_deref())
                .unwrap_or("unknown"),
            container
                .and_then(|c| c.status.as_deref())
                .unwrap_or("running")
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
                .and_then(|b| b
                    .host_data_path
                    .as_deref()
                    .or(Some(b.dillinger_core_path.as_str())))
                .unwrap_or("n/a")
        ),
        String::new(),
        format!("Counts"),
        format!(
            "- Games: {}",
            health
                .and_then(|h| h.counts.as_ref())
                .and_then(|c| c.games)
                .unwrap_or(app.snapshot.games.len() as u64)
        ),
        format!(
            "- Platforms: {}",
            health
                .and_then(|h| h.counts.as_ref())
                .and_then(|c| c.platforms)
                .map(|n| n.to_string())
                .unwrap_or_else(|| "n/a".to_string())
        ),
        format!(
            "- Sessions: {}",
            health
                .and_then(|h| h.counts.as_ref())
                .and_then(|c| c.sessions)
                .map(|n| n.to_string())
                .unwrap_or_else(|| "n/a".to_string())
        ),
        format!(
            "- Collections: {}",
            health
                .and_then(|h| h.counts.as_ref())
                .and_then(|c| c.collections)
                .map(|n| n.to_string())
                .unwrap_or_else(|| "n/a".to_string())
        ),
        String::new(),
        format!("Volumes"),
        format!(
            "- Docker volumes detected: {}",
            app.snapshot.live_docker_volume_names.len()
        ),
        format!(
            "- Managed extra volumes: {}",
            app.snapshot.managed_volumes.len()
        ),
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

    let text: Vec<Line> = lines.iter().map(|l| Line::from(l.as_str())).collect();

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

    let volume_entries = build_volume_entries(&app.snapshot);

    // Volume list (left pane).
    let items: Vec<ListItem> = volume_entries
        .iter()
        .map(|entry| match entry {
            VolumeListEntry::Managed {
                managed,
                live,
                docker,
            } => {
                let live_tag = if *live { "[live] " } else { "[missing] " };
                let bind_tag = if docker.as_ref().map(|docker| docker.is_bind).unwrap_or(true) {
                    "[bind] "
                } else {
                    ""
                };
                let label = format!(
                    "[{}] {}{}{}",
                    volume_role_label(managed.purpose.as_ref(), &managed.docker_volume_name),
                    live_tag,
                    bind_tag,
                    truncate(&managed.name, 32)
                );
                ListItem::new(label)
            }
            VolumeListEntry::DockerOnly(docker) => {
                let bind_tag = if docker.is_bind { "[bind] " } else { "" };
                let label = format!(
                    "[{} docker] {}{}",
                    volume_role_label(None, &docker.name),
                    bind_tag,
                    truncate(&docker.name, 32)
                );
                ListItem::new(label)
            }
        })
        .collect();

    let list = if items.is_empty() {
        List::new(vec![ListItem::new("No managed or Docker volumes found")]).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Volume Selection "),
        )
    } else {
        List::new(items)
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Volume Selection "),
            )
            .highlight_style(Style::default().fg(Color::Black).bg(Color::Green))
    };
    frame.render_stateful_widget(list, chunks[0], &mut app.volume_state);

    // Volume details (right pane).
    let idx = app.volume_state.selected().unwrap_or(0);
    let detail_text = if let Some(entry) = volume_entries.get(idx) {
        match entry {
            VolumeListEntry::Managed {
                managed,
                live,
                docker,
            } => {
                let container_mount_path = volume_container_mount_path(managed);
                let mut lines = vec![
                    format!("{}", managed.name),
                    String::new(),
                    format!(
                        "Purpose: {}",
                        volume_role_label(managed.purpose.as_ref(), &managed.docker_volume_name)
                    ),
                    format!("Docker volume: {}", managed.docker_volume_name),
                    format!("Stored host path: {}", managed.host_path),
                    format!("Dillinger Core path: {}", container_mount_path),
                    format!("Status: {}", managed.status),
                    format!(
                        "Friendly label: {}",
                        managed.friendly_name.as_deref().unwrap_or("n/a")
                    ),
                    format!(
                        "Storage tag: {}",
                        managed
                            .storage_type
                            .as_ref()
                            .map(|s| s.as_str())
                            .unwrap_or("n/a")
                    ),
                    format!("Created: {}", managed.created_at),
                    String::new(),
                    format!(
                        "Live Docker volume: {}",
                        if *live { "present" } else { "missing" }
                    ),
                ];

                if let Some(docker) = docker {
                    lines.extend([
                        format!("Driver: {}", docker.driver),
                        format!("Bind-backed: {}", if docker.is_bind { "yes" } else { "no" }),
                        format!(
                            "Resolved host path: {}",
                            docker.host_path.as_deref().unwrap_or("n/a")
                        ),
                        format!(
                            "Docker mountpoint: {}",
                            if docker.mountpoint.is_empty() {
                                "n/a"
                            } else {
                                &docker.mountpoint
                            }
                        ),
                    ]);
                } else if *live {
                    lines.push("This Docker volume exists, but detailed inspect metadata was not available in the current refresh.".to_string());
                } else {
                    lines.push("This selection is configured in Dillinger, but the Docker volume is not present in `docker volume ls`.".to_string());
                }

                lines.extend([
                    String::new(),
                    "Press Enter to edit purpose, label, and storage metadata.".to_string(),
                ]);
                lines.join("\n")
            }
            VolumeListEntry::DockerOnly(vol) => {
                let container_mount_path = docker_container_mount_path(&vol.name);
                vec![
                    format!("{}", vol.name),
                    String::new(),
                    format!("Inferred purpose: {}", volume_role_label(None, &vol.name)),
                    format!("Driver: {}", vol.driver),
                    format!("Bind-backed: {}", if vol.is_bind { "yes" } else { "no" }),
                    format!("Host path: {}", vol.host_path.as_deref().unwrap_or("n/a")),
                    format!("Docker mountpoint: {}", if vol.mountpoint.is_empty() { "n/a" } else { &vol.mountpoint }),
                    format!("Dillinger Core path: {}", container_mount_path),
                    String::new(),
                    "Managed by Dillinger: no".to_string(),
                    String::new(),
                    "Press Enter to adopt/edit this bind-backed Docker volume, or c to create a new one.".to_string(),
                ]
                .join("\n")
            }
        }
    } else {
        "Select a managed volume or Docker volume to see details.".to_string()
    };

    let detail_spans: Vec<Line> = detail_text
        .lines()
        .map(|l| Line::from(l.to_string()))
        .collect();
    let details = Paragraph::new(detail_spans)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Volume Details "),
        )
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
                let plays = g.metadata.as_ref().and_then(|m| m.play_count).unwrap_or(0);
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
                .or(game
                    .platforms
                    .as_ref()
                    .and_then(|ps| ps.first().map(|p| p.platform_id.as_str())))
                .unwrap_or("unknown");
            vec![
                game.title.clone(),
                String::new(),
                format!("ID: {}", game.id),
                format!("Slug: {}", game.slug.as_deref().unwrap_or("n/a")),
                format!("Default platform: {}", platform),
                format!(
                    "Play count: {}",
                    game.metadata
                        .as_ref()
                        .and_then(|m| m.play_count)
                        .unwrap_or(0)
                ),
                format!(
                    "Last played: {}",
                    game.metadata
                        .as_ref()
                        .and_then(|m| m.last_played.as_deref())
                        .unwrap_or("n/a")
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
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Game Details "),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(details, chunks[1]);
}

fn render_logs(frame: &mut Frame, area: Rect, app: &App) {
    let lines = &app.snapshot.log_lines;
    let total = lines.len();

    // viewport height (leave 2 rows for the block border)
    let viewport = area.height.saturating_sub(2) as usize;

    // Scroll is anchored to the bottom by default; log_scroll lets user pan up.
    let from_bottom = app.log_scroll;
    let end = total.saturating_sub(from_bottom);
    let start = end.saturating_sub(viewport);

    let visible: Vec<Line> = lines[start..end]
        .iter()
        .map(|l| Line::from(l.as_str()))
        .collect();

    let scroll_info = if total == 0 {
        "no logs".to_string()
    } else {
        format!("lines {}-{} of {}", start + 1, end, total)
    };
    let title = format!(" Logs — {} ", scroll_info);

    let block = Block::default()
        .borders(Borders::ALL)
        .title(title.as_str())
        .style(Style::default().fg(Color::White));
    let paragraph = Paragraph::new(visible)
        .block(block)
        .wrap(Wrap { trim: false });
    frame.render_widget(paragraph, area);
}

fn render_modal(frame: &mut Frame, area: Rect, app: &App) {
    match &app.modal {
        Modal::None => {}
        Modal::CreateVolume {
            name,
            path,
            purpose,
            focus,
            error,
            working,
        } => {
            let modal_area = centered_rect(64, 14, area);
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
            frame.render_widget(
                Paragraph::new("Purpose: blank | core | roms | download_cache | installed")
                    .style(label_style),
                rows[4],
            );
            frame.render_widget(
                Paragraph::new(purpose.as_str()).style(field_style(*focus == 2)),
                rows[5],
            );

            let hint = if *working {
                "Creating Docker volume and persisting Dillinger config…".to_string()
            } else if let Some(e) = error {
                format!("Error: {}", e)
            } else {
                "Tab/Enter moves fields. Purpose controls /data, /roms, /cache, or /installed/<name>. Esc cancels.".to_string()
            };
            frame.render_widget(
                Paragraph::new(hint)
                    .style(Style::default().fg(Color::Gray))
                    .wrap(Wrap { trim: true }),
                rows[6],
            );
        }
        Modal::EditVolume {
            docker_vol_name,
            host_path,
            name,
            friendly_name,
            storage_type,
            purpose,
            focus,
            error,
            working,
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
            frame.render_widget(
                Paragraph::new(name.as_str()).style(field_style(*focus == 0)),
                rows[1],
            );
            frame.render_widget(
                Paragraph::new("Friendly label (optional):").style(label_style),
                rows[2],
            );
            frame.render_widget(
                Paragraph::new(friendly_name.as_str()).style(field_style(*focus == 1)),
                rows[3],
            );
            frame.render_widget(
                Paragraph::new("Storage tag: blank | ssd | platter | archive").style(label_style),
                rows[4],
            );
            frame.render_widget(
                Paragraph::new(storage_type.as_str()).style(field_style(*focus == 2)),
                rows[5],
            );
            frame.render_widget(Paragraph::new("Purpose: blank | core | roms | download_cache | installed | downloads | installers").style(label_style), rows[6]);
            frame.render_widget(
                Paragraph::new(purpose.as_str()).style(field_style(*focus == 3)),
                rows[7],
            );

            let hint = if *working {
                "Saving Dillinger volume management…".to_string()
            } else if let Some(e) = error {
                format!("Error: {}", e)
            } else {
                format!(
                    "Volume: {}  Host: {}  Enter on last field saves. Esc cancels.",
                    docker_vol_name, host_path
                )
            };
            frame.render_widget(
                Paragraph::new(hint)
                    .style(Style::default().fg(Color::Gray))
                    .wrap(Wrap { trim: true }),
                rows[8],
            );
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
                .constraints([
                    Constraint::Length(1),
                    Constraint::Length(1),
                    Constraint::Min(0),
                ])
                .split(inner);

            frame.render_widget(
                Paragraph::new("Search query (blank clears filter):")
                    .style(Style::default().fg(Color::Yellow)),
                rows[0],
            );
            frame.render_widget(
                Paragraph::new(input.as_str()).style(field_style(true)),
                rows[1],
            );
            frame.render_widget(
                Paragraph::new("Enter to apply. Esc to cancel.")
                    .style(Style::default().fg(Color::Gray)),
                rows[2],
            );
        }
        Modal::ConfirmPull {
            local_version,
            remote_version,
            image_base,
        } => {
            let modal_area = centered_rect(70, 11, area);
            frame.render_widget(Clear, modal_area);
            let block = Block::default()
                .borders(Borders::ALL)
                .title(" Image Update Available ")
                .style(Style::default().fg(Color::Yellow));
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
                    Constraint::Length(1),
                ])
                .split(inner);

            let local_str = local_version.as_deref().unwrap_or("not installed");
            frame.render_widget(
                Paragraph::new(format!("Image:  {}", image_base))
                    .style(Style::default().fg(Color::White)),
                rows[0],
            );
            frame.render_widget(
                Paragraph::new(format!("Local:  {}", local_str))
                    .style(Style::default().fg(Color::DarkGray)),
                rows[1],
            );
            frame.render_widget(
                Paragraph::new(format!("Remote: {}  (newer)", remote_version))
                    .style(Style::default().fg(Color::Green)),
                rows[2],
            );
            let hint = if local_version.is_some() {
                "Enter/y pull & start latest   s start with local   Esc cancel"
            } else {
                "Enter/y pull & start latest   Esc cancel"
            };
            frame.render_widget(
                Paragraph::new(hint).style(Style::default().fg(Color::Gray)),
                rows[5],
            );
        }
        Modal::CommandOutput { title, lines } => {
            let modal_area = centered_rect(80, 20, area);
            frame.render_widget(Clear, modal_area);
            let block = Block::default()
                .borders(Borders::ALL)
                .title(title.as_str())
                .style(Style::default().fg(Color::Cyan));
            frame.render_widget(block, modal_area);

            let inner = shrink(modal_area, 1);
            let rows = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Min(1), Constraint::Length(1)])
                .split(inner);

            // Show last N lines that fit in the available area
            let max_lines = rows[0].height as usize;
            let display_lines: Vec<Line> = lines
                .iter()
                .rev()
                .take(max_lines)
                .rev()
                .map(|l| Line::from(l.as_str()))
                .collect();
            frame.render_widget(
                Paragraph::new(display_lines).wrap(Wrap { trim: false }),
                rows[0],
            );
            frame.render_widget(
                Paragraph::new("Enter or Esc to dismiss").style(Style::default().fg(Color::Gray)),
                rows[1],
            );
        }
    }
}

fn field_style(focused: bool) -> Style {
    if focused {
        Style::default()
            .fg(Color::Black)
            .bg(Color::White)
            .add_modifier(Modifier::BOLD)
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
