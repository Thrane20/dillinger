use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct Game {
    pub id: u64,        // This is the game database ID,
    pub gamedb: String, // This is the name of the game database
    pub slug: String,   // This is the slug of the game
    pub name: String,   // This is the name of the game
    pub json: Value,    // This is the raw JSON data returned from the game database
}

impl Game {

    pub fn get_identified_slug(&self) -> String {
        format!("{}-{}", self.gamedb, self.slug)
    }

    pub fn new() -> Game {
        Game {
            id: 0,
            gamedb: "".to_string(),
            slug: "".to_string(),
            name: "".to_string(),
            json: serde_json::Value::Null,
        }
    }

}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct PathConfig {
    pub docker_volume_dir: String,
    pub data_dir: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct SecretsConfig {
    pub twitch_client_id: String,
    pub twitch_client_secret: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct DillingerConfig {
    pub paths: PathConfig,
    pub secrets: SecretsConfig,
}



