use std::fmt::Error;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use super::playstats::PlayStats;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Game {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub play_stats: Vec<PlayStats>
}