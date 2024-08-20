use std::fmt::Error;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PlayStats {
    pub time_played: Option<chrono::DateTime<chrono::Utc>>,
    pub duration: Option<u32>
}