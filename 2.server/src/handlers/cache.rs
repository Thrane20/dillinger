use std::sync::Arc;
use log::info;

use crate::config;
use crate::{config::MasterConfig, entities::game::Game};
use crate::handlers::files;

pub fn write_cache_last_search(game: Game) {
    // Find the directory to the last search cache
    let config = config::get_master_config();
    info!("The config is: {:?}", config);
    info!("The root dir is: {:?}", config.root_dir);
    let cache_dir = &config.root_dir.join("system/search_cache");
    let cache_file = cache_dir.join("last_search.toml");

    info!("Writing last search cache to: {:?}", cache_file);

    // Write the file
    let toml = toml::to_string(&game).unwrap();
    files::write_file(&cache_file, toml, true);
}
