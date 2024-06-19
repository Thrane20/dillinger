use std::convert::Infallible;
use log::info;
use serde::Serialize;
use crate::handlers::docker_interactor::{self};
use crate::helpers::docker_run_params::DockerRunParams;

#[derive(Serialize, serde::Deserialize)]
pub struct Game {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub last_played: Option<chrono::DateTime<chrono::Utc>>,
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


pub async fn game_launch(_: Game) -> Result<impl warp::Reply, Infallible> {
    
    let run_params = DockerRunParams::new("alpine:latest".to_string())
    .volumes(vec!["/Users/iansorbello/Documents/docker_volumes/hello_world:/tmp:rw".to_string()])
    .interactive(true)
    .tty(true)
    .remove(true)
    .build();
        
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


#[cfg(test)]
mod tests {
    use super::*;
    use warp::http::StatusCode;
    use warp::reply::Reply;

    #[tokio::test]
    async fn test_game_launch() {
        let game = Game::default(); // Replace with your actual Game creation logic
        let resp: Result<_, Infallible> = game_launch(game).await;
        let resp = resp.unwrap().into_response();

        assert_eq!(resp.status(), StatusCode::OK);
        // Add more assertions based on your expected response
    }
}