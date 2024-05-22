use std::env;
use env_logger::Env;
use axum::{routing::get, routing::post, Router};
use axum::extract::Json;
use handlers::diagnostics;
use handlers::game;

mod handlers;

#[tokio::main]
async fn main() {
    println!("Starting server...");

    // Initialize the logger
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();

    let port = env::var("PORT").unwrap_or("3060".to_string());
    let app = build_all_routes();

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    println!("Dillinger server is running on port: {}", port);
    axum::serve(listener, app).await.unwrap();
}

fn build_all_routes() -> Router {
    Router::new()
        .route("/", get(|| async { "You shouldn't have come back, Flynn." }))
        .route("/diag/ping", get(crate::diagnostics::ping))
        .route("/diag/docker_daemon", get(crate::diagnostics::docker_daemon_status))
        .route("/game/launch", post(handlers::game::game_launch))    
}