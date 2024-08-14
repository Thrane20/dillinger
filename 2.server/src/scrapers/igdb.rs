use reqwest::header::{ HeaderMap, HeaderValue, ACCEPT, USER_AGENT };
use async_trait::async_trait;
use crate::scrapers::scrapers::{ AuthToken, GameDatabase, ScrapeEntry, ScreenshotInfo, PlatformEntry };


pub struct IgdbDatabase {
    pub auth_token: AuthToken,
}

unsafe impl Send for IgdbDatabase {}

#[async_trait]
impl GameDatabase for IgdbDatabase {
    
    async fn authentiate(&mut self) -> Result<AuthToken, reqwest::Error> {
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

    async fn search_game(&mut self, name: &str) -> Vec<ScrapeEntry> {
        
        let token = self.authentiate().await;

        if token.is_err() {
            println!(
                "Error authenticating with IGDB. You may need to check your configured credentials."
            );
        }

        let token = token.unwrap();
        self.auth_token = token.clone();

        println!("Authenticated");

        let url = format!("https://api.igdb.com/v4/games/?search={}&fields=id,name,slug", name);

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
        let games: Vec<ScrapeEntry> = res
            .unwrap()
            .as_array()
            .unwrap()
            .into_iter()
            .map(|game| ScrapeEntry {
                id: game["id"].as_u64().unwrap(),
                slug: game["slug"].as_str().unwrap().to_string(),
                name: game["name"].as_str().unwrap().to_string(),
                gamedb: "igdb".to_string(),
                file: "unknown".to_string(),
                last_scraped: "".to_string(),
                json: serde_json::Value::Null,
            })
            .collect();

        games
    }

    async fn search_platform(&mut self, _name: &str) -> Vec<PlatformEntry> {
        
        let token = self.authentiate().await;

        if token.is_err() {
            println!(
                "Error authenticating with IGDB. You may need to check your configured credentials."
            );
        }

        let token = token.unwrap();
        self.auth_token = token.clone();

        println!("Authenticated");

        let url = format!("https://api.igdb.com/v4/platforms");

        let client = reqwest::blocking::Client::new();
        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("reqwest"));
    
        let res = client
            .post(&url)
            .body("fields abbreviation,alternative_name,category,checksum,created_at,generation,name,platform_family,platform_logo,slug,summary,updated_at,url,versions,websites;")
            .header("Client-ID", "lpzomulxapy5mrfftuxcnwidw5ob2q")
            .header("Authorization", format!("Bearer {}", token.access_token))
            .headers(headers)
            .send()
            .unwrap()
            .json::<serde_json::Value>();

        // convert the json response to a vector of platform structs
        let platforms: Vec<PlatformEntry> = res
            .unwrap()
            .as_array()
            .unwrap()
            .into_iter()
            .map(|game| PlatformEntry {
                id: game["id"].as_u64().unwrap(),
                slug: game["slug"].as_str().unwrap().to_string(),
                name: game["name"].as_str().unwrap().to_string(),
                file: "unknown".to_string(),
                gamedb: "igdb".to_string(),
                last_scraped: "".to_string(),
                json: serde_json::Value::Null,
            })
            .collect();

        platforms
    }

    fn get_game_data(&mut self, id: u64, name: String) -> ScrapeEntry {
        
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
            .body(format!("fields *, screenshots.*; where id = {};", id))
            .send()
            .unwrap()
            .json::<serde_json::Value>();

        // check if res is ok and convert res to a json object, handle the error if not ok
        let game_data_values = match res {
            Ok(json) => {
                // create a game object from the json response
                ScrapeEntry {
                    id: id,
                    name: json[0]["name"].as_str().unwrap().to_string(),
                    slug: json[0]["slug"].as_str().unwrap().to_string(),
                    file: "unknown".to_string(),
                    gamedb: "igdb".to_string(),
                    last_scraped: "".to_string(),
                    json: json[0].clone(),
                }
            },
            Err(error) => {
                println!("Error: {}", error);
                ScrapeEntry {
                    id: id,
                    name: name,
                    slug: "unknown".to_string(),
                    gamedb: "igdb".to_string(),
                    file: "unknown".to_string(),
                    last_scraped: "".to_string(),
                    json: serde_json::Value::Null,
                }
            }
        };

        game_data_values
    }

    fn get_platform_data(&mut self, id: u64, name: String) -> PlatformEntry {
        
        println!("Getting platform data for id: {}", id);

        let url = format!("https://api.igdb.com/v4/platforms");

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

        // print the res
        println!("{:?}", res);

        // check if res is ok and convert res to a json object, handle the error if not ok
        let platform_data_values = match res {
            Ok(json) => {
                // create a game object from the json response
                PlatformEntry {
                    id: id,
                    name: json[0]["name"].as_str().unwrap().to_string(),
                    slug: json[0]["slug"].as_str().unwrap().to_string(),
                    gamedb: "igdb".to_string(),
                    file: "unknown".to_string(),
                    last_scraped: "".to_string(),
                    json: json[0].clone(),
                }
            },
            Err(error) => {
                println!("Error: {}", error);
                PlatformEntry {
                    id: id,
                    name: name,
                    slug: "unknown".to_string(),
                    gamedb: "igdb".to_string(),
                    file: "unknown".to_string(),
                    last_scraped: "".to_string(),
                    json: serde_json::Value::Null,
                }
            }
        };

        platform_data_values
    }

    fn get_screenshots(&mut self, id: u64, screenshot_info: Vec<ScreenshotInfo>) -> u32 {
        
        println!("Getting screenshots for id: {}", id);

        // Iterate through the screenshot info and get the screenshots
        let mut num_screenshots: u32 = 0;
        for screenshot in screenshot_info {
            println!("{:?}", screenshot.file_path);
            // First, check to see if the screenshot is already downloaded
            if std::path::Path::new(&screenshot.file_path).exists() {
                println!("Screenshot ID {} already downloaded. Skipping...", screenshot.id);
                continue;
            }
            let mut file = std::fs::File::create(screenshot.file_path).unwrap();
            let mut response = reqwest::blocking::get(&screenshot.url).unwrap();
            response.copy_to(&mut file).unwrap();
            drop(file);
            num_screenshots+=1;
        }

        num_screenshots
    }
    
}
