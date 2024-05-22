use axum::{extract::Json, http::StatusCode, response::IntoResponse};
use std::{collections::HashMap, os::macos::raw::stat};
use log::info;

use crate::handlers::docker;

pub struct Game {
    pub slug: String,
}

pub async fn game_launch(Json(body): Json<HashMap<String, String>>) -> impl IntoResponse {
    info!("Game launch function executed - got the following body: {:?}", body);

    let run_params = docker::DockerRunParams {
        container_name: "hello-world".to_string(),
        image_name: "test_hello_world".to_string(),
        container_id: None,
    };

    match docker::docker_run_container(run_params).await {
        Ok(run_params_out) => {
            info!("Container launched successfully with params: {:?}", run_params_out);
            (StatusCode::OK, format!("pong: {:?}", run_params_out))
        }
        Err(e) => {
            info!("Failed to launch container: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to launch container: {:?}", e))
        }
    }
}


#[tokio::test]
async fn test_run_game() {
    let (parts, _body) = game_launch(Json(HashMap::new())).await.into_response().into_parts();
    assert!(parts.status.is_success());
}
