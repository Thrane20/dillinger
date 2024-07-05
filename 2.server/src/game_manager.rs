use crate::{
    config::MasterConfig,
    handlers::{
        self,
        files::{self, read_file},
    },
};
use std::{error::Error, path::PathBuf, sync::Arc};

/// Represents a single entry in the game cache.
#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct PlatformEntry {
    pub name: String,
    pub rom_files: Option<Vec<PathBuf>>,
    pub image_dir: Option<PathBuf>,
    pub metadata_file: Option<PathBuf>,
}

/// Represents a single entry in the game cache.
#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct GameCacheEntry {
    pub slug: String,
    pub title: String,
    pub thumbnail: Option<PathBuf>,
    pub platforms: Option<Vec<PlatformEntry>>,
}

/// Represents a collection of game cache entries.
#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct GameCacheEntries {
    pub entries: Vec<GameCacheEntry>,
}

impl GameCacheEntries {
    pub fn new() -> Self {
        GameCacheEntries {
            entries: Vec::new(),
        }
    }

    pub fn update(&mut self, new_entries: Vec<GameCacheEntry>) {
        // Update logic here
        self.entries.extend(new_entries);
    }
}

impl From<Vec<GameCacheEntry>> for GameCacheEntries {
    /// Converts a vector of `GameCacheEntry` into `GameCacheEntries`.
    fn from(entries: Vec<GameCacheEntry>) -> Self {
        GameCacheEntries { entries }
    }
}

pub async fn prime_game_cache(
    attempt: u8,
    config: Arc<MasterConfig>,
) -> Result<GameCacheEntries, Box<dyn Error>> {
    // Limit to 3 attempts - bail if more than that
    if (attempt > 3) {
        return Err("Failed to build game cache after 3 attempts".into());
    }

    // Otherwise, read the cache
    println!("Reading game cache...");
    let game_cache = match read_game_cache(Arc::clone(&config)) {
        Ok(game_cache) => game_cache,
        Err(e) => {
            // Can't get the cache, or likely, it's not built yet
            println!("Error reading game cache: {:?} - building new cache", e);
            build_game_cache(Arc::clone(&config)).await.unwrap();

            // recurse to try again
            Box::pin(prime_game_cache(attempt + 1, config)).await?
        }
    };
    Ok(game_cache)
}

/// Reads the game cache from a file and returns the deserialized `GameCacheEntries`.
///
/// # Arguments
///
/// * `config` - The master configuration.
///
/// # Returns
///
/// Returns a `Result` containing the deserialized `GameCacheEntries` or an error.
pub fn read_game_cache(config: Arc<MasterConfig>) -> Result<GameCacheEntries, Box<dyn Error>> {
    let game_cache_path = config.root_dir.join("game_cache.toml");
    let game_cache_toml = match files::read_file(&game_cache_path) {
        Some(toml) => toml,
        None => return Err("Game cache not found".into()),
    };

    let game_cache_entries: GameCacheEntries = toml::from_str(&game_cache_toml)?;

    Ok(game_cache_entries)
}

/// Builds the game cache by scanning the root directory for game directories and writes the cache to a file.
///
/// # Arguments
///
/// * `config` - The master configuration.
///
/// # Returns
///
/// Returns a `Result` indicating whether the game cache was successfully built or an error.
pub async fn build_game_cache(config: Arc<MasterConfig>) -> Result<bool, Box<dyn Error>> {
    // Iterate the top directories from the root - these are all the games
    let entries = files::get_dirs_in_dir(&config.root_dir);

    let mut game_cache: Vec<GameCacheEntry> = Vec::new();

    for entry in entries {
        if let Some(file_name) = entry.file_name() {
            if let Some(file_name_str) = file_name.to_str() {
                // Get the primary toml manifest. It will be the slug for the game
                // as in <slug>.toml - if it doesn't exist, create an empty one
                let manifest = match get_manifest(&entry, file_name_str) {
                    Some(manifest) => manifest,
                    None => {
                        // Create an empty manifest
                        handlers::socket_client::send_message(format!(
                            "Manifest not found - creating: {}",
                            file_name_str
                        ))
                        .await;
                        create_empty_manifest(&entry, file_name_str);
                        continue;
                    }
                };

                let sub_entries = files::get_dirs_in_dir(&entry);
                let mut platforms: Vec<PlatformEntry> = Vec::new();
                for sub_entry in sub_entries {
                    if let Some(sub_file_name_str) = sub_entry.file_name() {
                        let platform_entry = PlatformEntry {
                            name: sub_file_name_str.to_str().unwrap().to_string(),
                            rom_files: None,
                            image_dir: None,
                            metadata_file: None,
                        };
                        platforms.push(platform_entry);
                    }
                }
                let game_cache_entry = GameCacheEntry {
                    slug: file_name_str.to_string(),
                    title: manifest.title,
                    thumbnail: manifest.thumbnail,
                    platforms: platforms.into(),
                };
                game_cache.push(game_cache_entry);
            }
        }
    }

    let game_cache_entries: GameCacheEntries = game_cache.into();
    let toml = toml::to_string(&game_cache_entries);
    let game_cache_path = config.root_dir.join("game_cache.toml");
    files::write_file(&game_cache_path, toml.unwrap(), false);

    Ok(true)
}

fn create_empty_manifest(entry: &PathBuf, file_name_str: &str) {
    let manifest = GameCacheEntry {
        slug: file_name_str.to_string(),
        title: file_name_str.to_string(),
        thumbnail: None,
        platforms: None,
    };
    let toml = toml::to_string(&manifest);
    let manifest_path = entry.join(format!("{}.toml", file_name_str));
    files::write_file(&manifest_path, toml.unwrap(), false);
}

fn get_manifest(entry: &PathBuf, file_name_str: &str) -> Option<GameCacheEntry> {
    let manifest_path = entry.join(format!("{}.toml", file_name_str));
    let manifest_toml = match read_file(&manifest_path) {
        Some(toml) => toml,
        None => return None,
    };

    let manifest: Result<GameCacheEntry, _> = toml::from_str(&manifest_toml);
    match manifest {
        Ok(entry) => Some(entry),
        Err(_) => None,
    }
}
