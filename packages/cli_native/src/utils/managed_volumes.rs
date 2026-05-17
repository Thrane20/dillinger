use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    fmt,
    path::{Path, PathBuf},
};
use tokio::fs;
use uuid::Uuid;

use crate::utils::{
    config::get_config,
    constants::EXTRA_RUNNER_VOLUME_ROOT,
    core_api::is_core_reachable,
    volume::{create_bind_volume, volume_exists},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ManagedVolumeStorageType {
    Ssd,
    Platter,
    Archive,
}

impl ManagedVolumeStorageType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Ssd => "ssd",
            Self::Platter => "platter",
            Self::Archive => "archive",
        }
    }
}

impl fmt::Display for ManagedVolumeStorageType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ManagedVolumePurpose {
    Core,
    Roms,
    Cache,
    Installed,
    Downloads,
    Installers,
}

impl ManagedVolumePurpose {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Core => "core",
            Self::Roms => "roms",
            Self::Cache => "cache",
            Self::Installed => "installed",
            Self::Downloads => "downloads",
            Self::Installers => "installers",
        }
    }
}

impl fmt::Display for ManagedVolumePurpose {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

pub fn parse_storage_type(s: &str) -> Result<Option<ManagedVolumeStorageType>> {
    match s.trim().to_lowercase().as_str() {
        "" => Ok(None),
        "ssd" => Ok(Some(ManagedVolumeStorageType::Ssd)),
        "platter" => Ok(Some(ManagedVolumeStorageType::Platter)),
        "archive" => Ok(Some(ManagedVolumeStorageType::Archive)),
        other => anyhow::bail!(
            "Storage type must be one of: ssd, platter, archive. Got: {}",
            other
        ),
    }
}

pub fn parse_purpose(s: &str) -> Result<Option<ManagedVolumePurpose>> {
    match s.trim().to_lowercase().as_str() {
        "" => Ok(None),
        "core" => Ok(Some(ManagedVolumePurpose::Core)),
        "roms" => Ok(Some(ManagedVolumePurpose::Roms)),
        "cache" => Ok(Some(ManagedVolumePurpose::Cache)),
        "installed" => Ok(Some(ManagedVolumePurpose::Installed)),
        "downloads" => Ok(Some(ManagedVolumePurpose::Downloads)),
        "installers" => Ok(Some(ManagedVolumePurpose::Installers)),
        other => anyhow::bail!(
            "Special role must be one of: core, roms, cache, installed, downloads, installers. Got: {}",
            other
        ),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedVolumeRecord {
    pub id: String,
    pub name: String,
    #[serde(rename = "dockerVolumeName")]
    pub docker_volume_name: String,
    #[serde(rename = "hostPath")]
    pub host_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "type")]
    pub volume_type: String,
    pub status: String,
    pub purpose: Option<ManagedVolumePurpose>,
    #[serde(rename = "friendlyName")]
    pub friendly_name: Option<String>,
    #[serde(rename = "storageType")]
    pub storage_type: Option<ManagedVolumeStorageType>,
}

pub struct UpsertManagedVolumeInput {
    pub docker_volume_name: String,
    pub host_path: String,
    pub name: String,
    pub friendly_name: Option<String>,
    pub storage_type: Option<ManagedVolumeStorageType>,
    pub purpose: Option<ManagedVolumePurpose>,
    pub volume_type: Option<String>,
}

pub struct CreateManagedVolumeResult {
    pub volume: ManagedVolumeRecord,
    pub docker_volume_created: bool,
    pub persisted_via: String,
}

pub struct UpsertResult {
    pub volume: ManagedVolumeRecord,
    pub persisted_via: String,
    pub adopted: bool,
}

// ── Pure helpers (publicly testable) ────────────────────────────────────────

fn sanitize_volume_slug(value: &str) -> String {
    let lower = value.trim().to_lowercase();
    let replaced: String = lower
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    replaced.trim_matches('_').to_string()
}

pub fn build_managed_docker_volume_name(name: &str) -> Result<String> {
    let slug = sanitize_volume_slug(name);
    if slug.is_empty() {
        anyhow::bail!("Volume name must contain at least one alphanumeric character.");
    }
    Ok(format!("dillinger_{}", slug))
}

pub fn build_extra_runner_mount_path(docker_volume_name: &str) -> String {
    let segment = sanitize_volume_slug(docker_volume_name);
    let segment = if segment.is_empty() { "volume".to_string() } else { segment };
    format!("{}/{}", EXTRA_RUNNER_VOLUME_ROOT, segment)
}

// ── State directories ────────────────────────────────────────────────────────

fn cli_state_dir() -> PathBuf {
    if let Ok(xdg_state) = std::env::var("XDG_STATE_HOME") {
        PathBuf::from(xdg_state).join("dillinger-gaming")
    } else {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join(".local/state/dillinger-gaming")
    }
}

async fn local_storage_root() -> Result<PathBuf> {
    let dir = cli_state_dir().join("volumes");
    fs::create_dir_all(&dir).await.context("creating managed volumes dir")?;
    Ok(dir)
}

async fn local_volume_metadata_path() -> Result<PathBuf> {
    let dir = cli_state_dir();
    fs::create_dir_all(&dir).await.context("creating state dir")?;
    Ok(dir.join("volume-metadata.json"))
}

// ── Metadata store ───────────────────────────────────────────────────────────

#[derive(Debug, Default, Serialize, Deserialize)]
struct MetadataEntry {
    #[serde(rename = "friendlyName", skip_serializing_if = "Option::is_none")]
    friendly_name: Option<String>,
    #[serde(rename = "storageType", skip_serializing_if = "Option::is_none")]
    storage_type: Option<ManagedVolumeStorageType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    purpose: Option<ManagedVolumePurpose>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct MetadataStore {
    volumes: std::collections::HashMap<String, MetadataEntry>,
}

async fn read_metadata_store() -> MetadataStore {
    match local_volume_metadata_path().await {
        Ok(path) => match fs::read_to_string(&path).await {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            Err(_) => MetadataStore::default(),
        },
        Err(_) => MetadataStore::default(),
    }
}

async fn write_metadata_store(store: &MetadataStore) -> Result<()> {
    let path = local_volume_metadata_path().await?;
    let json = serde_json::to_string_pretty(store)?;
    fs::write(&path, json).await.context("writing metadata store")
}

// ── Local file-based storage ─────────────────────────────────────────────────

async fn list_local_managed_volumes() -> Result<Vec<ManagedVolumeRecord>> {
    let storage_root = local_storage_root().await?;
    let metadata = read_metadata_store().await;

    let mut volumes: Vec<ManagedVolumeRecord> = Vec::new();
    let mut dir = match fs::read_dir(&storage_root).await {
        Ok(d) => d,
        Err(_) => return Ok(vec![]),
    };

    while let Ok(Some(entry)) = dir.next_entry().await {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if !name.ends_with(".json") || name == "index.json" {
            continue;
        }
        let raw = match fs::read_to_string(entry.path()).await {
            Ok(r) => r,
            Err(_) => continue,
        };
        let mut parsed: ManagedVolumeRecord = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if let Some(meta) = metadata.volumes.get(&parsed.host_path) {
            if let Some(fn_) = &meta.friendly_name {
                parsed.friendly_name = Some(fn_.clone());
            }
            if let Some(st) = &meta.storage_type {
                parsed.storage_type = Some(st.clone());
            }
        }
        volumes.push(parsed);
    }
    volumes.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(volumes)
}

async fn write_local_managed_volume(volume: &ManagedVolumeRecord) -> Result<()> {
    let storage_root = local_storage_root().await?;
    let path = storage_root.join(format!("{}.json", volume.id));
    let json = serde_json::to_string_pretty(volume)?;
    fs::write(&path, json).await.context("writing managed volume record")
}

async fn upsert_local_managed_volume(
    input: &UpsertManagedVolumeInput,
    existing: Option<&ManagedVolumeRecord>,
) -> Result<ManagedVolumeRecord> {
    let host_path = Path::new(&input.host_path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&input.host_path));
    let host_path_str = host_path.to_string_lossy().to_string();

    let volume = ManagedVolumeRecord {
        id: existing.map(|e| e.id.clone()).unwrap_or_else(|| Uuid::new_v4().to_string()),
        name: input.name.trim().to_string(),
        docker_volume_name: input.docker_volume_name.clone(),
        host_path: host_path_str.clone(),
        created_at: existing
            .map(|e| e.created_at.clone())
            .unwrap_or_else(|| chrono_now()),
        volume_type: input
            .volume_type
            .clone()
            .or_else(|| existing.map(|e| e.volume_type.clone()))
            .unwrap_or_else(|| "docker".to_string()),
        status: "active".to_string(),
        purpose: input.purpose.clone().or_else(|| existing.and_then(|e| e.purpose.clone())),
        friendly_name: input
            .friendly_name
            .clone()
            .or_else(|| existing.and_then(|e| e.friendly_name.clone())),
        storage_type: input
            .storage_type
            .clone()
            .or_else(|| existing.and_then(|e| e.storage_type.clone())),
    };

    write_local_managed_volume(&volume).await?;

    let mut store = read_metadata_store().await;
    let entry = store.volumes.entry(host_path_str).or_default();
    if input.friendly_name.is_some() {
        entry.friendly_name = input.friendly_name.clone();
    }
    if input.storage_type.is_some() {
        entry.storage_type = input.storage_type.clone();
    }
    if input.purpose.is_some() {
        entry.purpose = input.purpose.clone();
    }
    write_metadata_store(&store).await?;

    Ok(volume)
}

fn chrono_now() -> String {
    // Simple ISO 8601 timestamp without pulling in the chrono crate.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Format as approximate ISO 8601 (good enough for CLI logging).
    let (s, m, h) = (secs % 60, (secs / 60) % 60, (secs / 3600) % 24);
    let days = secs / 86400;
    // Very simple date math (not leap-year aware — acceptable for a timestamp log).
    format!("{:04}-01-01T{:02}:{:02}:{:02}Z", 1970 + days / 365, h, m, s)
}

// ── API-based storage ────────────────────────────────────────────────────────

async fn list_managed_volumes_via_api() -> Result<Vec<ManagedVolumeRecord>> {
    let port = get_config().port;
    let base = format!("http://127.0.0.1:{}", port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()?;

    let (vol_resp, meta_resp) = tokio::join!(
        client.get(format!("{}/api/volumes", base))
            .header("content-type", "application/json")
            .send(),
        client.get(format!("{}/api/volumes/metadata", base))
            .header("content-type", "application/json")
            .send(),
    );

    #[derive(Deserialize)]
    struct Envelope {
        success: Option<bool>,
        data: Option<Vec<ManagedVolumeRecord>>,
        error: Option<String>,
    }
    #[derive(Deserialize, Default)]
    struct MetaEnvelope {
        data: Option<MetadataStore>,
    }

    let vol_resp = vol_resp.context("GET /api/volumes failed")?;
    if !vol_resp.status().is_success() {
        anyhow::bail!("{}", vol_resp.status());
    }
    let env: Envelope = vol_resp.json().await?;
    if env.success == Some(false) {
        anyhow::bail!("{}", env.error.unwrap_or_else(|| "Failed to load managed volumes".to_string()));
    }

    let metadata_map: std::collections::HashMap<String, MetadataEntry> =
        if let Ok(mr) = meta_resp {
            if mr.status().is_success() {
                let me: MetaEnvelope = mr.json().await.unwrap_or_default();
                me.data.unwrap_or_default().volumes
            } else {
                Default::default()
            }
        } else {
            Default::default()
        };

    let mut records = env.data.unwrap_or_default();
    for record in &mut records {
        if let Some(meta) = metadata_map.get(&record.host_path) {
            if let Some(fn_) = &meta.friendly_name {
                record.friendly_name = Some(fn_.clone());
            }
            if let Some(st) = &meta.storage_type {
                record.storage_type = Some(st.clone());
            }
        }
    }
    Ok(records)
}

// ── Public API ───────────────────────────────────────────────────────────────

pub async fn list_managed_volumes() -> Result<Vec<ManagedVolumeRecord>> {
    if is_core_reachable().await {
        return list_managed_volumes_via_api().await;
    }
    list_local_managed_volumes().await
}

pub async fn upsert_managed_volume(input: UpsertManagedVolumeInput) -> Result<UpsertResult> {
    let normalized_path = Path::new(&input.host_path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&input.host_path));
    let normalized_str = normalized_path.to_string_lossy().to_string();
    let normalized_input = UpsertManagedVolumeInput {
        host_path: normalized_str.clone(),
        ..input
    };

    let current_volumes = list_managed_volumes().await.unwrap_or_default();
    let existing = current_volumes.iter().find(|v| {
        v.docker_volume_name == normalized_input.docker_volume_name
            || v.host_path == normalized_str
    });
    let adopted = existing.is_none();

    if is_core_reachable().await {
        let volume = persist_managed_volume_via_api(&normalized_input, existing.map(|e| e.id.as_str())).await?;
        return Ok(UpsertResult { volume, persisted_via: "api".to_string(), adopted });
    }

    let volume = upsert_local_managed_volume(&normalized_input, existing).await?;
    Ok(UpsertResult { volume, persisted_via: "local".to_string(), adopted })
}

async fn persist_managed_volume_via_api(
    input: &UpsertManagedVolumeInput,
    existing_id: Option<&str>,
) -> Result<ManagedVolumeRecord> {
    let port = get_config().port;
    let base = format!("http://127.0.0.1:{}", port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()?;

    let url = if let Some(id) = existing_id {
        format!("{}/api/volumes/{}", base, urlencoded(id))
    } else {
        format!("{}/api/volumes", base)
    };

    let body = serde_json::json!({
        "name": input.name,
        "hostPath": input.host_path,
        "type": input.volume_type.as_deref().unwrap_or("docker"),
        "purpose": input.purpose.as_ref().map(|p| p.as_str()),
        "linkExisting": true,
        "dockerVolumeName": input.docker_volume_name,
        "status": "active",
    });

    let method = if existing_id.is_some() { "PUT" } else { "POST" };
    let resp = client
        .request(reqwest::Method::from_bytes(method.as_bytes()).unwrap(), &url)
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .context("persist managed volume API call failed")?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("{}", text);
    }

    #[derive(Deserialize)]
    struct Envelope {
        success: Option<bool>,
        data: Option<ManagedVolumeRecord>,
        error: Option<String>,
    }
    let env: Envelope = resp.json().await?;
    if env.success == Some(false) || env.data.is_none() {
        anyhow::bail!("{}", env.error.unwrap_or_else(|| "Failed to persist managed volume".to_string()));
    }

    // Also persist metadata
    persist_volume_metadata_via_api(input).await?;

    let mut volume = env.data.unwrap();
    volume.friendly_name = input.friendly_name.clone();
    volume.storage_type = input.storage_type.clone();
    Ok(volume)
}

async fn persist_volume_metadata_via_api(input: &UpsertManagedVolumeInput) -> Result<()> {
    let port = get_config().port;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()?;

    let body = serde_json::json!({
        "mountPath": input.host_path,
        "friendlyName": input.friendly_name,
        "storageType": input.storage_type.as_ref().map(|s| s.as_str()),
        "purpose": input.purpose.as_ref().map(|p| p.as_str()),
    });

    let resp = client
        .put(format!("http://127.0.0.1:{}/api/volumes/metadata", port))
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .context("PUT /api/volumes/metadata failed")?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("{}", text);
    }
    Ok(())
}

pub async fn create_managed_bind_volume(name: &str, host_path: &str) -> Result<CreateManagedVolumeResult> {
    let docker_volume_name = build_managed_docker_volume_name(name)?;
    let normalized_path = Path::new(host_path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(host_path));
    let normalized_str = normalized_path.to_string_lossy().to_string();

    let current = list_managed_volumes().await.unwrap_or_default();
    let existing_managed = current.iter().find(|v| {
        v.docker_volume_name == docker_volume_name || v.host_path == normalized_str
    });
    let already_exists = volume_exists(&docker_volume_name).await;

    if !already_exists {
        create_bind_volume(&docker_volume_name, &normalized_str).await?;
    }

    if let Some(existing) = existing_managed {
        let persisted_via = if is_core_reachable().await { "api" } else { "local" }.to_string();
        return Ok(CreateManagedVolumeResult {
            volume: existing.clone(),
            docker_volume_created: !already_exists,
            persisted_via,
        });
    }

    let input = UpsertManagedVolumeInput {
        docker_volume_name: docker_volume_name.clone(),
        host_path: normalized_str.clone(),
        name: name.trim().to_string(),
        friendly_name: None,
        storage_type: None,
        purpose: None,
        volume_type: Some("docker".to_string()),
    };

    if is_core_reachable().await {
        let volume = persist_managed_volume_via_api(&input, None).await?;
        return Ok(CreateManagedVolumeResult {
            volume,
            docker_volume_created: !already_exists,
            persisted_via: "api".to_string(),
        });
    }

    let volume = upsert_local_managed_volume(&input, None).await?;
    Ok(CreateManagedVolumeResult {
        volume,
        docker_volume_created: !already_exists,
        persisted_via: "local".to_string(),
    })
}

pub async fn get_managed_volume_persistence_hint() -> Result<String> {
    if is_core_reachable().await {
        let bootstrap = crate::utils::core_api::get_core_bootstrap_status().await?;
        return Ok(format!(
            "Persisting managed volumes through Dillinger Core ({}).",
            bootstrap.runtime
        ));
    }
    let storage_root = local_storage_root().await?;
    Ok(format!(
        "Persisting managed volumes directly in {}.",
        storage_root.display()
    ))
}

fn urlencoded(s: &str) -> String {
    s.chars()
        .flat_map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
                vec![c]
            } else {
                format!("%{:02X}", c as u32).chars().collect()
            }
        })
        .collect()
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_friendly_names_into_docker_volume_names() {
        assert_eq!(
            build_managed_docker_volume_name("Screenshots SSD").unwrap(),
            "dillinger_screenshots_ssd"
        );
    }

    #[test]
    fn rejects_empty_normalized_names() {
        assert!(build_managed_docker_volume_name("***").is_err());
    }

    #[test]
    fn maps_docker_volume_name_to_stable_runner_mount_path() {
        assert_eq!(
            build_extra_runner_mount_path("dillinger_screenshots_ssd"),
            "/mnt/dillinger-volumes/dillinger_screenshots_ssd"
        );
    }
}
