use reqwest::header::{ HeaderMap, HeaderValue, ACCEPT, USER_AGENT };
use crate::global_types::Game;
use crate::scrapers::scrapers::{ AuthToken, GameDatabase };


pub struct IgdbDatabase {
    pub auth_token: AuthToken,
}

impl GameDatabase for IgdbDatabase {
    
    fn authentiate(&mut self) -> Result<AuthToken, reqwest::Error> {
        println!("Authenticating with IGDB");

        let client_id = "lpzomulxapy5mrfftuxcnwidw5ob2q";
        let client_secret = "me0k8eu07kdp2ayb5anxn05mvpzasb";
        let grant_type = "client_credentials";

        let url = format!(
            "https://id.twitch.tv/oauth2/token?client_id={}&client_secret={}&grant_type={}",
            client_id,
            client_secret,
            grant_type
        );
        println!("URL: {}", url);

        let client = reqwest::blocking::Client::new();

        let res = client.post(url).send().unwrap().json::<serde_json::Value>();

        match res {
            Ok(json) => {
                Ok(AuthToken {
                    db: "igdb".to_string(),
                    access_token: json["access_token"].as_str().unwrap().to_string(),
                    expires_in: json["expires_in"].as_u64().unwrap(),
                    token_type: json["token_type"].as_str().unwrap().to_string(),
                })
            }
            Err(error) => {
                println!("Error: {}", error);
                Err(error)
            }
        }
    }

    fn search_game(&mut self, name: &str) -> Vec<Game> {
        
        let token = self.authentiate();

        if token.is_err() {
            println!(
                "Error authenticating with IGDB. You may need to check your configured credentials."
            );
        }

        let token = token.unwrap();
        self.auth_token = token.clone();

        println!("Authenticated");

        let url = format!("https://api.igdb.com/v4/games/?search={}&fields=id,name", name);

        let client = reqwest::blocking::Client::new();
        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("reqwest"));

        let res = client
            .post(&url)
            .header("Client-ID", "lpzomulxapy5mrfftuxcnwidw5ob2q")
            .header("Authorization", format!("Bearer {}", token.access_token))
            .headers(headers)
            .send()
            .unwrap()
            .json::<serde_json::Value>();

        // convert the json response to a vector of game structs
        let games: Vec<Game> = res
            .unwrap()
            .as_array()
            .unwrap()
            .into_iter()
            .map(|game| Game {
                id: game["id"].as_u64().unwrap(),
                slug: "unknown".to_string(),
                name: game["name"].as_str().unwrap().to_string(),
                gamedb: "igdb".to_string(),
                json: serde_json::Value::Null,
            })
            .collect();

        games
    }

    fn get_game_data(&mut self, id: u64, name: String) -> Game {
        
        println!("Getting game data for id: {}", id);

        let url = format!("https://api.igdb.com/v4/games");

        let client = reqwest::blocking::Client::new();
        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("reqwest"));

        let res = client
            .post(&url)
            .header("Client-ID", "lpzomulxapy5mrfftuxcnwidw5ob2q")
            .header("Authorization", format!("Bearer {}", self.auth_token.access_token))
            .headers(headers)
            .body(format!("fields *; where id = {};", id))
            .send()
            .unwrap()
            .json::<serde_json::Value>();

        // check if res is ok and convert res to a json object, handle the error if not ok
        let game_data_values = match res {
            Ok(json) => {
                // create a game object from the json response
                Game {
                    id: id,
                    name: json[0]["name"].as_str().unwrap().to_string(),
                    slug: json[0]["slug"].as_str().unwrap().to_string(),
                    gamedb: "igdb".to_string(),
                    json: json[0].clone(),
                }
            },
            Err(error) => {
                println!("Error: {}", error);
                Game {
                    id: id,
                    name: name,
                    slug: "unknown".to_string(),
                    gamedb: "igdb".to_string(),
                    json: serde_json::Value::Null,
                }
            }
        };

        // test if the json value in the Game object has at least 1 entry
        // if not, then the game was not found in the database
        if game_data_values.json != serde_json::Value::Null {
            println!("Game data found.");
        }

        game_data_values
    }
    
}
