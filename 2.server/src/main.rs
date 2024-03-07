use std::env;
use axum::{routing::get, Router};
use handlers::diagnostics;

mod handlers;

#[tokio::main]
async fn main() {
    println!("Starting server...");

    let port = env::var("PORT").unwrap_or("8080".to_string());
    let app = build_all_routes();

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    println!("Dillinger server is running on port: {}", port);
    axum::serve(listener, app).await.unwrap();
}

fn build_all_routes() -> Router {
    Router::new()
        .route("/", get(|| async { "You shouldn't have come back, Flynn." }))
        .route("/ping", get(crate::diagnostics::ping))
}


