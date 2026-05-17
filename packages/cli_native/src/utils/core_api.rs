use anyhow::{Context, Result};
use serde::Deserialize;
use std::time::Duration;

use crate::utils::config::get_config;

fn core_base_url() -> String {
    let config = get_config();
    format!("http://127.0.0.1:{}", config.port)
}

fn build_client(timeout_secs: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .expect("reqwest client build failed")
}

#[derive(Debug, Clone, Deserialize, Default)]
#[allow(dead_code)]
pub struct CoreBootstrapStatus {
    pub initialized: bool,
    #[serde(rename = "dillingerCorePath", default)]
    pub dillinger_core_path: String,
    #[serde(default)]
    pub runtime: String,
    #[serde(rename = "hostDataPath")]
    pub host_data_path: Option<String>,
    pub volume: Option<CoreBootstrapVolume>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[allow(dead_code)]
pub struct CoreBootstrapVolume {
    pub name: String,
    #[serde(rename = "containerMount")]
    pub container_mount: String,
    #[serde(rename = "envVar")]
    pub env_var: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[allow(dead_code)]
pub struct CoreHealthStatus {
    pub status: String,
    pub timestamp: String,
    pub uptime: Option<f64>,
    pub counts: Option<CoreHealthCounts>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct CoreHealthCounts {
    pub games: Option<u64>,
    pub platforms: Option<u64>,
    pub sessions: Option<u64>,
    pub collections: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CoreGame {
    pub id: String,
    pub slug: Option<String>,
    pub title: String,
    #[serde(rename = "platformId")]
    pub platform_id: Option<String>,
    #[serde(rename = "defaultPlatformId")]
    pub default_platform_id: Option<String>,
    pub metadata: Option<CoreGameMetadata>,
    pub platforms: Option<Vec<CoreGamePlatform>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CoreGameMetadata {
    #[serde(rename = "lastPlayed")]
    pub last_played: Option<String>,
    #[serde(rename = "playCount")]
    pub play_count: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CoreGamePlatform {
    #[serde(rename = "platformId")]
    pub platform_id: String,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct LaunchResponse {
    pub session_id: Option<String>,
    pub session_status: Option<String>,
}

/// Checks whether the core API is reachable within a 2-second window.
pub async fn is_core_reachable() -> bool {
    let client = build_client(2);
    client
        .get(format!("{}/api/health", core_base_url()))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

pub async fn get_core_bootstrap_status() -> Result<CoreBootstrapStatus> {
    let client = build_client(4);
    let resp = client
        .get(format!("{}/api/bootstrap/status", core_base_url()))
        .send()
        .await
        .context("GET /api/bootstrap/status failed")?;
    if !resp.status().is_success() {
        anyhow::bail!(
            "{} {}",
            resp.status().as_u16(),
            resp.status().canonical_reason().unwrap_or("error")
        );
    }
    resp.json::<CoreBootstrapStatus>()
        .await
        .context("deserializing bootstrap status")
}

pub async fn get_core_health_status() -> Result<CoreHealthStatus> {
    let client = build_client(4);
    let resp = client
        .get(format!("{}/api/health", core_base_url()))
        .send()
        .await
        .context("GET /api/health failed")?;
    if !resp.status().is_success() {
        anyhow::bail!("{}", resp.status());
    }
    resp.json::<CoreHealthStatus>()
        .await
        .context("deserializing health status")
}

pub async fn list_core_games() -> Result<Vec<CoreGame>> {
    #[derive(Deserialize)]
    struct Envelope {
        success: Option<bool>,
        data: Option<Vec<CoreGame>>,
        error: Option<String>,
        message: Option<String>,
    }

    let client = build_client(4);
    let resp = client
        .get(format!("{}/api/games", core_base_url()))
        .send()
        .await
        .context("GET /api/games failed")?;
    if !resp.status().is_success() {
        anyhow::bail!("{}", resp.status());
    }
    let env: Envelope = resp.json().await.context("deserializing games")?;
    if env.success == Some(false) {
        anyhow::bail!(
            "{}",
            env.error
                .or(env.message)
                .unwrap_or_else(|| "Failed to load games".to_string())
        );
    }
    Ok(env.data.unwrap_or_default())
}

pub async fn launch_core_game(game_id: &str) -> Result<LaunchResponse> {
    #[derive(Deserialize)]
    struct Session {
        id: Option<String>,
        status: Option<String>,
    }
    #[derive(Deserialize)]
    struct Envelope {
        session: Option<Session>,
    }

    let client = build_client(10);
    let resp = client
        .post(format!(
            "{}/api/launch/{}",
            core_base_url(),
            urlencoded(game_id)
        ))
        .header("content-type", "application/json")
        .body(r#"{"mode":"local"}"#)
        .send()
        .await
        .context("POST /api/launch failed")?;
    if !resp.status().is_success() {
        anyhow::bail!("{}", resp.status());
    }
    let env: Envelope = resp.json().await.context("deserializing launch response")?;
    Ok(LaunchResponse {
        session_id: env.session.as_ref().and_then(|s| s.id.clone()),
        session_status: env.session.as_ref().and_then(|s| s.status.clone()),
    })
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
