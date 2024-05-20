use std::path::PathBuf;
use serde::{ Serialize, Deserialize };

use crate::files;
use crate::scrapers::scrapers::{ScrapeEntry, PlatformEntry};
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

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct MCPManager {
    pub selected_game: String
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
    pub fn games_get_parent_dir(&self) -> PathBuf {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("games");
        path
    }

    pub fn games_list_all(&self) -> Vec<String> {
        let mut games: Vec<String> = Vec::new();
        let path = self.games_get_parent_dir();
        let paths = files::get_dirs_in_dir(&path);
        for path in paths {
            let filename = path.file_name().unwrap().to_str().unwrap().to_string();
            games.push(filename);
        }
        games
    }

    /// Returns the path to where all scraper data lives
    pub fn get_scraper_data_path(&self) -> PathBuf {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("scraper_data");
        path
    }

    pub fn get_platform_scraper_data_path(&self) -> PathBuf {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("platform_scraper_data");
        path
    }

    /// The MCP file is the master file that links all db files together
    pub fn get_mcp_file(&self) -> String {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("mcp.json");
        path.to_str().unwrap().to_string()
    }

    fn create_default_mcp_file(path: &String) {
        // create the file
        let mcp_manager = MCPManager {
            selected_game: "".to_string()
        };
        let json_serialized = serde_json::to_string_pretty(&mcp_manager).unwrap();
        files::write_file(&PathBuf::from(path.clone()), json_serialized, true);
    }

    /// Load the mcp file from the path provided by the get_mcp_file function
    pub fn load_mcp_file(&self) -> MCPManager {
        let path = self.get_mcp_file();

        // test to see if this file exists
        if !files::file_exists(&PathBuf::from(path.clone())) {
            self::ManifestManager::create_default_mcp_file(&path);
        }

        let manifest_content = files::read_file(&PathBuf::from(path));

        let manifest: Result<MCPManager,serde_json::Error> = serde_json::from_str(&manifest_content);
        match manifest {
            Ok(manifest) => {
                manifest
            },
            Err(_) => {
                MCPManager {
                    selected_game: "".to_string()
                }
            }
        }
    }  

    // /// Get the path to a game's manifest file
    // pub fn get_manifest_file_path(&self, filename: String) -> String {
    //     let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
    //     path.push(filename);
    //     path.to_str().unwrap().to_string()
    // }

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

    pub fn add_platform_scrape_file(&self, scrape_activity: &mut PlatformEntry) -> PathBuf {
        // Store the scraped data to the scraper directory
        let json_serialized = serde_json::to_string_pretty(&scrape_activity).unwrap();
        let mut path = self.get_platform_scraper_data_path();
        path.push(format!("{}-{}", scrape_activity.gamedb, scrape_activity.slug));
        path.push(format!("{}.json", scrape_activity.get_identified_slug()));
        scrape_activity.file = path.clone().to_string_lossy().to_string();
        println!("Writing scraped platform data to {:?}", path);

        // write the file out
        files::write_file(&path, json_serialized, true);

        path
    }

    /// Generates a new scrape activity. Can create a new file, or append data
    /// to an existing file.
    pub fn add_scrape_activity(&self, scrape_activity: &ScrapeEntry) {
        let mut path = self.games_get_parent_dir();
        path.push(format!("{}", scrape_activity.slug));
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


