use std::convert::Infallible;
use log::info;
use serde::Serialize;
use crate::handlers::docker_interactor::{self, DockerRunParams};

#[derive(Serialize, serde::Deserialize)]
pub struct Game {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub last_played: Option<String>,
    pub times_played: Option<u32>,
}

impl Default for Game {
    fn default() -> Self {
        Self {
            slug: String::new(),
            name: String::new(),
            description: String::new(),
            last_played: None,
            times_played: None,
        }
    }
}


pub async fn game_launch(game: Game) -> Result<impl warp::Reply, Infallible> {
    
    let run_params = DockerRunParams {
        image_name: "alpine:latest".to_string()
    };
        
    let reply = match docker_interactor::docker_run(run_params).await {
        Ok(run_params_out) => {
            info!(
                "Container launched successfully with params: {:?}",
                run_params_out
            );
            warp::reply::with_status("Game launched", warp::http::StatusCode::OK)
        }
        Err(e) => {
            info!("Failed to launch container: {:?}", e);
            warp::reply::with_status("Game launched", warp::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    };
    Ok(reply)
}


// test_game_default
#[cfg(test)]
mod tests {
    use warp::{reply::Reply, test::request};

    use super::*;

    #[tokio::test]
    async fn test_game_launch() {
        // Create a test game
        let game = Game::default();
    
        // Create a test request
        request()
            .method("GET")
            .path("/game_launch")
            .header("content-type", "application/json")
            .json(&game);
    
        // Call the handler with the test request and get the reply
        let resp = game_launch(game).await.unwrap();
        let resp = resp.into_response();
    
        // Check the status code and body of the reply
        assert_eq!(resp.status(), 200);
    }
    
}