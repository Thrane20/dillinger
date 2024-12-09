use serde::{Deserialize, Serialize};
use std::{env, path::PathBuf, sync::Arc};
use toml;

use crate::platform::Platform;

pub const DILLINGER_ROOT_DIR: &str = "DILLINGER_ROOT_DIR";
pub const WINE_RUNNER_NAME: &str = "dillinger-wine:latest";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MasterConfig {
    pub port: u16,
    pub root_dir: PathBuf,
    pub entries_dir: PathBuf,
    pub platforms: Vec<Platform>
}

impl MasterConfig {
    pub fn set_entries_dir(&mut self) {
        self.entries_dir = self.root_dir.join("entries");
    }
}

pub fn get_master_config() -> Arc<MasterConfig> {
    // Start by finding out where to look for the master config
    let config_dir = env::var(DILLINGER_ROOT_DIR).unwrap_or_else(|_| {
        println!("DILLINGER_ROOT_DIR is not set, trying the current directory");
        ".".to_string()
    });

    // Second, load the file
    let config_path = format!("{}/dillinger_config.toml", config_dir);
    println!("Looking for the master config file at: {}", config_path);
    let content = std::fs::read_to_string(&config_path)
    .unwrap_or_else(|_| { panic!("Could not load master config file.") });

    // Parse the content into a MasterConfig
    let mut master_config: MasterConfig =
        toml::from_str(&content)
        .unwrap_or_else(|_| { panic!("Could not parse master config file.") });

    // And calculate any paths we need
    master_config.set_entries_dir();

    let master_config : Arc<MasterConfig> = Arc::new(master_config);
    
    
    // Finally, if we got the config, we know our root dir
    // master_config.root_dir = PathBuf::from(config_path);

    // Yay!
    master_config
}
