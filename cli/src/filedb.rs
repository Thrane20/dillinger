use std::path::PathBuf;
use serde::{ Serialize, Deserialize };

use crate::files;
use crate::scrapers::scrapers::{ScrapeEntry};
use crate::global_types::{ DillingerConfig };

/// This code file manages all the file based operations for Dillinger
/// That's correct, no database, just files. Human readability ftw.

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct Game {
    pub name: String,
    pub last_played: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct Manifest {
    pub game: Game,
    pub scrape_activities: Vec<ScrapeEntry>,
}

pub struct ManifestManager {
    pub dillinger_config: DillingerConfig,
}

impl ManifestManager {
    pub fn new(dillinger_config: &DillingerConfig) -> ManifestManager {
        ManifestManager {
            dillinger_config: dillinger_config.clone(),
        }
    }

    /// Returns the path to the games directory
    pub fn get_games_path(&self) -> PathBuf {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("games");
        path
    }

    /// Returns the path to where all scraper data lives
    pub fn get_scraper_data_path(&self) -> PathBuf {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("scraper_data");
        path
    }

    /// The MCP file is the master file that links all db files together
    pub fn get_mcp_file(&self) -> String {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("mcp.json");
        path.to_str().unwrap().to_string()
    }

    /// Get the path to a game's manifest file
    pub fn get_manifest_file_path(&self, filename: String) -> String {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push(filename);
        path.to_str().unwrap().to_string()
    }

    pub fn add_scrape_file(&self, scrape_activity: &mut ScrapeEntry) -> PathBuf {
        // Store the scraped data to the scraper directory
        let json_serialized = serde_json::to_string_pretty(&scrape_activity).unwrap();
        let mut path = self.get_scraper_data_path();
        path.push(format!("{}-{}", scrape_activity.gamedb, scrape_activity.slug));
        path.push(format!("{}.json", scrape_activity.get_identified_slug()));
        scrape_activity.file = path.clone().to_string_lossy().to_string();
        println!("Writing scraped data to {:?}", path);

        // write the file out
        files::write_file(&path, json_serialized, true);

        path
    }

    /// Generates a new scrape activity. Can create a new file, or append data
    /// to an existing file.
    pub fn add_scrape_activity(&self, scrape_activity: &ScrapeEntry) {
        let mut path = self.get_games_path();
        path.push(format!("{}.json", scrape_activity.get_readable_name()));
        
        // check if path file exists - use what's there, otherwise, create new
        let mut manifest: Manifest;
        let mut manifest_content: String;
        if path.exists() {
            // Load the manifest file
            manifest_content = files::read_file(&path);
            manifest = serde_json::from_str(&manifest_content).unwrap();
        } else {
            // Create the manifest file
            manifest = Manifest {
                game: Game { name: scrape_activity.name.clone(), last_played: "".to_string() },
                scrape_activities: Vec::new(),
            };
        }

        // Add the scrape activity
        let scrape_entry = ScrapeEntry {
            id: scrape_activity.id,
            name: scrape_activity.name.clone(),
            gamedb: scrape_activity.gamedb.clone(),
            slug: scrape_activity.slug.clone(),
            last_scraped: chrono::Utc::now().naive_utc().to_string(),
            file: scrape_activity.file.clone(),
            json: "".to_string().into(),
        };

        manifest.scrape_activities.push(scrape_entry);

        // Write the manifest out
        manifest_content = serde_json::to_string_pretty(&manifest).unwrap();
        files::write_file(&path, manifest_content, true);
    }
}
