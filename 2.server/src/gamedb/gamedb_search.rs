use log::info;

use crate::{entities::dillinger_error::DillingerError, gamedb::{gamedb::GameDb, igdb::Igdb}};
use super::gamedb::GameDbGameEntry;

pub async fn search_title(
    search_term: String,
    search_db: String,
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
