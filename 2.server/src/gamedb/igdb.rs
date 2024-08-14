use std::collections::HashMap;

use super::gamedb::{GameDb, GameDbGameEntry};
use super::gamedbtoken::GameDbToken;
use crate::entities::dillinger_error::DillingerError;
use crate::handlers::web_request::{self, post};
use async_trait::async_trait;
use log::{error, info};

const IGDB_NAME: &str = "igdb";
const IGDB_URL: &str = "https://api.igdb.com/v4/games";
const IGDB_URL_PLATFORMS: &str = "https://api.igdb.com/v4/platforms";
const IGDB_URL_SCREENSHOTS: &str = "https://api.igdb.com/v4/screenshots";

pub struct Igdb {
    pub token: GameDbToken,
}

impl Igdb {
    pub fn new() -> Self {
        let token: GameDbToken = GameDbToken::new(IGDB_NAME.to_string());
        Igdb { token }
    }
}

#[async_trait]
impl GameDb for Igdb {
    async fn authenticate(&mut self) -> Result<GameDbToken, DillingerError> {
        info!("Authenticating with IGDB");

        // TODO: Get this from config
        let client_id = "lpzomulxapy5mrfftuxcnwidw5ob2q";
        let client_secret = "me0k8eu07kdp2ayb5anxn05mvpzasb";
        let grant_type = "client_credentials";

        let url = format!(
            "https://id.twitch.tv/oauth2/token?client_id={}&client_secret={}&grant_type={}",
            client_id, client_secret, grant_type
        );

        match post(url, None, None).await {
            Ok(json) => Ok(GameDbToken {
                db: IGDB_NAME.to_string(),
                id_token: None, // IGDB doesn't use id_tokens
                access_token: Some(json["access_token"].as_str().unwrap().to_string()),
                expires_in: Some(json["expires_in"].as_u64().unwrap()),
            }),
            Err(error) => {
                error!("Error: {}", error);
                Err(DillingerError {
                    description: "Error authenticating with IGDB".to_string(),
                })
            }
        }
    }

    async fn search_game(&mut self, name: &str) -> Vec<GameDbGameEntry> {

        // First, we need to authenticate to IGDB.
        // We should add caching here to avoid re-authenticating every time.
        let token = match self.authenticate().await {
            Ok(token) => {
                info!("token is {:?}", token);
                token
            }
            Err(_) => {
                // Not interested in the error here - just return an empty list
                return vec![];
            }
        };

        if let Some(token) = Some(token) {
            self.token = token.clone();
            let url = format!("{}", IGDB_URL);
            
            let mut headers = HashMap::new();
            headers.insert("Client-ID".to_string(), "lpzomulxapy5mrfftuxcnwidw5ob2q".to_string());
            headers.insert("Authorization".to_string(), format!("Bearer {}", token.access_token.unwrap()).as_str().to_string());

            //  fields name, involved_companies; search "Halo"
            let body = format!( "fields slug,name,summary,platforms,release_dates,involved_companies; search \"{}\";", name).to_string();
            
            match post(url, Some(headers), Some(body)).await {
                Ok(json) => {
                    let mut results = vec![];
                    for game in json.as_array().unwrap() {
                        info!("game is {:?}", game);
                        results.push(GameDbGameEntry {
                            game_db: IGDB_NAME.to_string(),
                            slug_game: game["slug"].as_str().unwrap_or("").to_string(),
                            slug_platform: "".to_string(),
                            name: game["name"].as_str().unwrap_or("").to_string(),
                            description: "".to_string(),
                        });
                    }
                    info!("results is {:?}", results);
                    return results;
                }
                Err(_) => {
                    // Not interested in the error here - just return an empty list
                    return vec![];
                }
            }
                

        }
        
        vec![]
    }

    async fn search_platform(&mut self, name: &str) -> Vec<String> {
        unimplemented!()
    }

    async fn get_game_data(&mut self, id: u64, name: String) -> String {
        unimplemented!()
    }

    async fn get_platform_data(&mut self, id: u64, name: String) -> String {
        unimplemented!()
    }

    async fn get_screenshots(&mut self, id: u64, screenshot_info: Vec<String>) -> u32 {
        unimplemented!()
    }
}
