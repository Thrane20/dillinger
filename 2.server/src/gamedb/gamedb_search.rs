use bollard::secret::PluginConfigInterfaceProtocolSchemeEnum;
use log::info;

use super::gamedb::GameDbGameEntry;
use crate::{
    entities::{dillinger_error::DillingerError, game::Game},
    gamedb::{gamedb::GameDb, igdb::Igdb}, handlers::cache,
};

pub async fn search_title(
    search_db: String,
    search_term: String
) -> Result<Vec<GameDbGameEntry>, DillingerError> {
    info!("route requested: search_title");
    info!("search db: {}", search_db);

    // Based on the db name, construct the appropriate gamedb object
    let mut db: Box<dyn GameDb> = match search_db.as_str() {
        "igdb" => Box::new(Igdb::new()),
        _ => {
            return Err(DillingerError {
                description: "Invalid search database".to_string(),
            })
        }
    };

    // Search for matching titles
    let results = db.search_game(&search_term).await;

    Ok(results)
}

pub async fn get_game_details(
    search_db: String,
    game_slug: String,
) -> Result<Game, DillingerError> {
    info!("route requested: get_game_details");
    info!("search db: {}", search_db);
    info!("search game_slug: {}", game_slug);

    // Based on the db name, construct the appropriate gamedb object
    let mut db: Box<dyn GameDb> = match search_db.as_str() {
        "igdb" => Box::new(Igdb::new()),
        _ => {
            return Err(DillingerError {
                description: "Invalid search database".to_string(),
            })
        }
    };

    // Search for matching titles
    match db.get_game_data(game_slug).await {
        Some(results) => {
            // Store the last result in the cache
            cache::write_cache_last_search(results.clone());
            Ok(results)
        },
        None => {
            return Err(DillingerError {
                description: "Could not find the title with provided slug".to_string(),
            })
        }
    }
}
