use std::fmt::Error;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::platform::Platform;

use super::playstats::PlayStats;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Game {
    pub slug: String,
    pub name: String,
    pub for_platform: Platform,
    pub summary: String,
    pub storyline: Option<String>,
    pub play_stats: Option<Vec<PlayStats>>,
    pub genres: Option<Vec<String>>,
    pub themes: Option<Vec<String>>,
    pub developers: Option<Vec<String>>,
    pub publishers: Option<Vec<String>>,
    pub screenshots: Option<Vec<String>>,
    pub videos: Option<Vec<String>>,
    pub websites: Option<Vec<String>>,
    pub release_date: Option<u64>,
}

impl Game {
    pub fn new() -> Self {
        Game {
            slug: "".to_string(),
            name: "".to_string(),
            summary: "".to_string(),
            for_platform: Platform::default(), 
            storyline: None, 
            play_stats: None,
            genres: None,
            themes: None,
            developers: None,
            publishers: None,
            screenshots: None,
            videos: None,
            websites: None,
            release_date: None
        }
    }
}