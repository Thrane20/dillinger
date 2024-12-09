use std::collections::HashMap;
use std::f32::consts::E;

use super::gamedb::{GameDb, GameDbGameEntry};
use super::gamedbtoken::GameDbToken;
use crate::entities::dillinger_error::DillingerError;
use crate::entities::game::{self, Game};
use crate::handlers::web_request::{self, post};
use crate::platform::Platform;
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
    // Authenticate with IGDB
    // Exchange our client_id and client_secret for an access token
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
                access_token: json["access_token"].as_str().map(|s| s.to_string()),
                expires_in: json["expires_in"].as_u64().map(|e| e),
            }),
            Err(error) => {
                error!("Error: {}", error);
                Err(DillingerError {
                    description: "Error authenticating with IGDB".to_string(),
                })
            }
        }
    }

    // Search IDGB by game title
    // We're after enough information to display a search result only
    async fn search_game(&mut self, name: &str) -> Vec<GameDbGameEntry> {
        // First, authenticate to IGDB.
        // TODO: add caching so we don't authenticate every time
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
            headers.insert(
                "Client-ID".to_string(),
                "lpzomulxapy5mrfftuxcnwidw5ob2q".to_string(),
            );
            headers.insert(
                "Authorization".to_string(),
                format!("Bearer {}", token.access_token.unwrap())
                    .as_str()
                    .to_string(),
            );

            // Here we tell IGDB what we want, and the search term
            let body = format!( "fields slug,name,summary,platforms.*,release_dates.date,involved_companies.company.name; search \"{}\"; limit 200;", name).to_string();

            // Send the request over the intergalactic airwaves
            match post(url, Some(headers), Some(body)).await {
                Ok(json) => {
                    let mut results = vec![];
                    for game in json.as_array().unwrap() {
                        // Extract the platforms - can be multiple
                        // So build up a string of all matching platform names
                        let mut platforms_names = vec![];
                        if let Some(platforms) = game["platforms"].as_array() {
                            for platform in platforms {
                                platforms_names
                                    .push(platform["name"].as_str().unwrap_or("").to_string());
                            }
                        }
                        let platform_names = platforms_names.join(" | ");

                        // Extract the release dates - can be multiple
                        // But we only want the first release date here
                        let mut release_date: u64 = 0;
                        if let Some(release_dates) = game["release_dates"].as_array() {
                            if let Some(first_release_date) = release_dates.get(0) {
                                let rd: u64 = first_release_date["date"].as_u64().unwrap_or(0);
                                release_date = rd;
                            }
                        }

                        // Munge and stuff the data into a GameDbGameEntry
                        results.push(GameDbGameEntry {
                            game_db: IGDB_NAME.to_string(),
                            slug_game: game["slug"].as_str().unwrap_or("").to_string(),
                            slug_platform: platform_names,
                            name: game["name"].as_str().unwrap_or("").to_string(),
                            description: game["summary"].as_str().unwrap_or("").to_string(),
                            release_date: release_date,
                        });
                    }
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

    async fn get_game_data(&mut self, game_slug: String) -> Option<Game> {
        // First, authenticate to IGDB.
        // TODO: add caching so we don't authenticate every time
        info!("get_game_data for igdb: game_slug: {}", game_slug);
        let token = match self.authenticate().await {
            Ok(token) => {
                info!("token is {:?}", token);
                token
            }
            Err(_) => {
                // Not interested in the error here - just return an empty list
                return None;
            }
        };

        if let Some(token) = Some(token) {
            self.token = token.clone();
            let url = format!("{}", IGDB_URL);

            let mut headers = HashMap::new();
            headers.insert(
                "Client-ID".to_string(),
                "lpzomulxapy5mrfftuxcnwidw5ob2q".to_string(),
            );
            headers.insert(
                "Authorization".to_string(),
                format!("Bearer {}", token.access_token.unwrap())
                    .as_str()
                    .to_string(),
            );

            // Here we tell IGDB what we want, and the search term
            let body = format!(
                "fields id,slug,name,summary,storyline,url,first_release_date,collections.name,themes.name, \
                videos.video_id,websites.url,genres.name,screenshots.image_id, screenshots.url, \
                artworks.image_id,artworks.url,involved_companies.company.name, platform.name, \
                involved_companies.developer,involved_companies.publisher; where slug = \"{}\";",
                game_slug
            )
            .to_string();

            // Send the request over the intergalactic airwaves
            match post(url, Some(headers), Some(body)).await {
                Ok(json) => {
                    let mut finalGame: Game = Game::new();
                    for game in json.as_array().unwrap() {
                        // Extract the platforms - can be multiple
                        // So build up a string of all matching platform names
                        let mut platforms_names = vec![];
                        if let Some(platforms) = game["platforms"].as_array() {
                            for platform in platforms {
                                platforms_names
                                    .push(platform["name"].as_str().unwrap_or("").to_string());
                            }
                        }
                        let platform_names = platforms_names.join(" | ");

                        // Extract the release dates - can be multiple
                        // But we only want the first release date here
                        let mut release_date: u64 = 0;
                        if let Some(release_dates) = game["release_dates"].as_array() {
                            if let Some(first_release_date) = release_dates.get(0) {
                                let rd: u64 = first_release_date["date"].as_u64().unwrap_or(0);
                                release_date = rd;
                            }
                        }

                        // Munge and stuff the data into a GameDbGameEntry
                        finalGame = Game {
                            name: game["name"].as_str().unwrap_or("").to_string(),
                            slug: game["slug"].as_str().unwrap_or("").to_string(),
                            summary: game["summary"].as_str().unwrap_or("").to_string(),
                            for_platform: Platform::default(),
                            storyline: game["storyline"].as_str().map(|s| s.to_string()),
                            release_date: game["first_release_date"].as_u64(),
                            play_stats: Some(vec![]),
                            genres: game["genres"].as_array().and_then(|arr| {
                                if arr.is_empty() {
                                    None
                                } else {
                                    Some(
                                        arr.iter()
                                            .filter_map(|item| {
                                                item["name"].as_str().map(|s| s.to_string())
                                            })
                                            .collect::<Vec<String>>(),
                                    )
                                }
                            }),
                            themes: game["themes"].as_array().and_then(|arr| {
                                if arr.is_empty() {
                                    None
                                } else {
                                    Some(
                                        arr.iter()
                                            .filter_map(|item| {
                                                item["name"].as_str().map(|s| s.to_string())
                                            })
                                            .collect::<Vec<String>>(),
                                    )
                                }
                            }),
                            developers: game["involved_companies"].as_array().and_then(|arr| {
                                if arr.is_empty() {
                                    None
                                } else {
                                    Some(
                                        arr.iter()
                                            .filter_map(|item| {
                                                item["company"].as_object().and_then(|company| {
                                                    company["name"].as_str().map(|s| s.to_string())
                                                })
                                            })
                                            .collect::<Vec<String>>(),
                                    )
                                }
                            }),
                            publishers: game["involved_companies"].as_array().and_then(|arr| {
                                if arr.is_empty() {
                                    None
                                } else {
                                    Some(
                                        arr.iter()
                                            .filter_map(|item| {
                                                item["company"].as_object().and_then(|company| {
                                                    company["name"].as_str().map(|s| s.to_string())
                                                })
                                            })
                                            .collect::<Vec<String>>(),
                                    )
                                }
                            }),
                            screenshots: game["screenshots"].as_array().and_then(|arr| {
                                if arr.is_empty() {
                                    None
                                } else {
                                    Some(
                                        arr.iter()
                                            .filter_map(|item| {
                                                item["image_id"].as_str().map(|s| s.to_string())
                                            })
                                            .collect::<Vec<String>>(),
                                    )
                                }
                            }),
                            videos: game["videos"].as_array().and_then(|arr| {
                                if arr.is_empty() {
                                    None
                                } else {
                                    Some(
                                        arr.iter()
                                            .filter_map(|item| {
                                                item["video_id"].as_str().map(|s| s.to_string())
                                            })
                                            .collect::<Vec<String>>(),
                                    )
                                }
                            }),
                            websites: game["websites"].as_array().and_then(|arr| {
                                if arr.is_empty() {
                                    None
                                } else {
                                    Some(
                                        arr.iter()
                                            .filter_map(|item| {
                                                item["url"].as_str().map(|s| s.to_string())
                                            })
                                            .collect::<Vec<String>>(),
                                    )
                                }
                            }),
                        };
                        // println!("---");
                        // println!("finalGame: {:?}", json.as_array());
                        // println!("---");
                    }
                    return Some(finalGame);
                }
                Err(_) => {
                    // Not interested in the error here - just return an empty list
                    info!("Error getting game data");
                    return None;
                }
            }
        }

        None
    }

    async fn get_platform_data(&mut self, id: u64, name: String) -> String {
        unimplemented!()
    }

    async fn get_screenshots(&mut self, id: u64, screenshot_info: Vec<String>) -> u32 {
        unimplemented!()
    }
}
