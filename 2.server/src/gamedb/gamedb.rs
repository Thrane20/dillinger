use std::fmt::Error;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::entities::dillinger_error::DillingerError;
use super::gamedbtoken::GameDbToken;

// A GameDB represents a database that can be used to search for games,  
// games assets, and platforms
#[async_trait]
pub trait GameDb : Send  {
    async fn authenticate(&mut self) -> Result<GameDbToken, DillingerError>;
    async fn search_game(&mut self, name: &str) -> Vec<GameDbGameEntry>;
    async fn search_platform(&mut self, name: &str) -> Vec<String>;
    async fn get_game_data(&mut self, id: u64, name: String) -> String;
    async fn get_platform_data(&mut self, id: u64, name: String) -> String;
    async fn get_screenshots(&mut self, id: u64, screenshot_info: Vec<String>) -> u32;
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct GameDbGameEntry {
    pub game_db: String,
    pub slug_game: String,
    pub slug_platform: String,
    pub name: String,
    pub description: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct GameDbPlatformEntry {
    pub slug_platform: String,
    pub name: String,
    pub description: String,
}