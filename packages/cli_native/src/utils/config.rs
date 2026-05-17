use anyhow::{Context, Result};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::utils::constants::{
    CLI_CONFIG_NAME, DEFAULT_AUTO_UPDATE, DEFAULT_CONTAINER_NAME, DEFAULT_IMAGE_NAME,
    DEFAULT_PORT, DEFAULT_VOLUME_NAME,
};

/// CLI configuration — mirrors the TypeScript CliConfig type and Conf key names.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliConfig {
    pub port: u16,
    #[serde(rename = "imageName")]
    pub image_name: String,
    #[serde(rename = "autoUpdate")]
    pub auto_update: bool,
    #[serde(rename = "volumeName")]
    pub volume_name: String,
    #[serde(rename = "containerName")]
    pub container_name: String,
}

impl Default for CliConfig {
    fn default() -> Self {
        Self {
            port: DEFAULT_PORT,
            image_name: DEFAULT_IMAGE_NAME.to_string(),
            auto_update: DEFAULT_AUTO_UPDATE,
            volume_name: DEFAULT_VOLUME_NAME.to_string(),
            container_name: DEFAULT_CONTAINER_NAME.to_string(),
        }
    }
}

/// Returns the path to the config file, matching the Conf library's XDG location.
pub fn config_path() -> PathBuf {
    if let Some(proj) = ProjectDirs::from("", "", CLI_CONFIG_NAME) {
        proj.config_dir().join("config.json")
    } else {
        std::env::temp_dir()
            .join(CLI_CONFIG_NAME)
            .join("config.json")
    }
}

/// Reads the persisted config, falling back to defaults on any error.
pub fn get_config() -> CliConfig {
    let path = config_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(parsed) = serde_json::from_str::<CliConfig>(&raw) {
            return parsed;
        }
    }
    CliConfig::default()
}

/// Persists the full config to disk, merging with the current stored config.
fn write_config(config: &CliConfig) -> Result<()> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("Creating config dir {:?}", parent))?;
    }
    let json = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, json)
        .with_context(|| format!("Writing config to {:?}", path))?;
    Ok(())
}

pub fn set_config_value(key: &str, value: &str) -> Result<()> {
    let mut config = get_config();
    match key {
        "port" => {
            let port: u16 = value.parse().context("port must be a valid TCP port number")?;
            if port == 0 {
                anyhow::bail!("port must be between 1 and 65535");
            }
            config.port = port;
        }
        "imageName" => config.image_name = value.to_string(),
        "autoUpdate" => {
            config.auto_update = value == "true";
        }
        "volumeName" => config.volume_name = value.to_string(),
        "containerName" => config.container_name = value.to_string(),
        other => anyhow::bail!("Unknown config key: {}", other),
    }
    write_config(&config)
}

pub fn reset_config() -> Result<()> {
    write_config(&CliConfig::default())
}

/// Returns the set of valid config key names (for validation).
pub fn config_keys() -> &'static [&'static str] {
    &["port", "imageName", "autoUpdate", "volumeName", "containerName"]
}
