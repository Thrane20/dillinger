
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::global_types::DillingerConfig;
use crate::scrapers::igdb::IgdbDatabase;

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct ScrapeEntry {
    pub id: u64,                // This is the game database ID,
    pub gamedb: String,         // This is the name of the game database
    pub slug: String,           // This is the slug of the game
    pub name: String,           // This is the name of the game
    pub file: String,           // This is the name of the file that contains the game data
    pub last_scraped: String,   // This is the last time the game was scraped
    pub json: Value,            // This is the raw JSON data returned from the game database
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct PlatformEntry {
    pub id: u64,                // This is the game database ID,
    pub gamedb: String,         // This is the name of the game database
    pub slug: String,           // This is the slug of the platform
    pub name: String,           // This is the name of the platform
    pub file: String,           // This is the name of the file that contains the platform data
    pub last_scraped: String,   // This is the last time the game was scraped
    pub json: Value,            // This is the raw JSON data returned from the game database
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct ScreenshotInfo {
    pub id: String,
    pub url: String,
    pub height: u64,
    pub file_path: PathBuf
}

impl ScrapeEntry {

    pub fn get_identified_slug(&self) -> String {
        format!("{}-{}", self.gamedb, self.slug)
    }

    pub fn get_readable_name(&self) -> String {
        self.name.clone()
    }   

    pub fn new() -> ScrapeEntry {
        ScrapeEntry {
            id: 0,
            gamedb: "".to_string(),
            slug: "".to_string(),
            name: "".to_string(),
            file: "".to_string(),
            last_scraped: "".to_string(),
            json: serde_json::Value::Null,
        }
    }

}

impl PlatformEntry {

    pub fn get_identified_slug(&self) -> String {
        format!("{}-{}", self.gamedb, self.slug)
    }

    pub fn get_readable_name(&self) -> String {
        self.name.clone()
    }   

    pub fn new() -> PlatformEntry {
        PlatformEntry {
            id: 0,
            gamedb: "".to_string(),
            slug: "".to_string(),
            name: "".to_string(),
            file: "".to_string(),
            last_scraped: "".to_string(),
            json: serde_json::Value::Null,
        }
    }

}


pub struct AuthToken {
    pub db: String,
    pub access_token: String,
    pub expires_in: u64,
    pub token_type: String,
}

impl AuthToken {
    
    pub(crate) fn clone(&self) -> AuthToken {
        AuthToken {
            db: self.db.clone(),
            access_token: self.access_token.clone(),
            expires_in: self.expires_in,
            token_type: self.token_type.clone(),
        }
    }

    pub(crate) fn new() -> AuthToken {
        AuthToken {
            db: "".to_string(),
            access_token: "".to_string(),
            expires_in: 0,
            token_type: "".to_string(),
        }
    }
}


pub trait GameDatabase  {
    fn authentiate(&mut self) -> Result<AuthToken, reqwest::Error>;
    fn search_game(&mut self, name: &str) -> Vec<ScrapeEntry>;
    fn search_platform(&mut self, name: &str) -> Vec<PlatformEntry>;
    fn get_game_data(&mut self, id: u64, name: String) -> ScrapeEntry;
    fn get_platform_data(&mut self, id: u64, name: String) -> PlatformEntry;
    fn get_screenshots(&mut self, id: u64, screenshot_info: Vec<ScreenshotInfo>) -> u32;
}


pub struct Scraper {
}

impl Scraper {

    /// Returns a specific gamedb scraper based on the name of the db
    pub fn get_scraper(game_db: String) -> Option<Box<dyn GameDatabase>> {
        let mut gamedb: Option<Box<dyn GameDatabase>> = None;
        match game_db.as_str() {
            "igdb" => {
                gamedb = Some(Box::new(IgdbDatabase { auth_token: AuthToken::new() }));
            }
            _ => { println!("Unknown game db {:?}. Scrape cancelled.", game_db); drop(None::<ScrapeEntry>);}
        }
        gamedb
    }

    pub fn get_matching_titles(name: String, gamedb : Option<&mut Box<dyn GameDatabase>>) -> Option<Vec<ScrapeEntry>> { 
        
        if let Some(mut db) = gamedb {
            // Search the games database for any specific matching titles
            let scraped_entries = &db.search_game(name.as_str());
            return Some(scraped_entries.to_vec());
        } else {
            None::<Vec<ScrapeEntry>>
        }
    }

    pub fn get_matching_platforms(name: String, gamedb : Option<&mut Box<dyn GameDatabase>>) -> Option<Vec<PlatformEntry>> { 
        
        if let Some(mut db) = gamedb {
            // Search the games database for any specific matching platforms
            let scraped_entries = &db.search_platform(name.as_str());
            return Some(scraped_entries.to_vec());
        } else {
            None::<Vec<PlatformEntry>>
        }
    }



}

