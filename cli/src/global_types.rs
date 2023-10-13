use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, TimeZone};





#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct PathConfig {
    pub docker_volume_dir: String,
    pub data_dir: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct SecretsConfig {
    pub twitch_client_id: String,
    pub twitch_client_secret: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct DillingerConfig {
    pub paths: PathConfig,
    pub secrets: SecretsConfig,
    pub romsites: Vec<RomSite>,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct RomSite {
    pub name: String,
    pub platform: String,
    pub url: String,
    pub pagespan: String,
}



