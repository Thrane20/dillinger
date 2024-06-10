use std::convert::Infallible;
use log::info;
use warp::http::StatusCode;
use warp::Filter;
use crate::handlers::docker_interactor::DockerContainer;
use warp::cors;

pub mod game;
pub mod handlers;
pub mod system;
pub mod helpers;

#[tokio::main]
pub async fn main() {
    let port = 3060;
    println!("Dillinger server is running on port: {}", port);

    // Set up path handlers
    let root = warp::path!().map(|| "You shouldn't have come back, Flynn.");

    // Ping route - used for diagnostics
    let ping_handler = warp::path!("diag" / "ping").and_then(diagnostics_ping_handler);

    // Docker status route - used for diagnostics
    let docker_status_handler =
        warp::path!("diag" / "docker_status").and_then(diagnostics_docker_status_handler);

    // Get a list of running containers
    let docker_list_containers_handler =
        warp::path!("sys" / "list_containers").and_then(handler_list_containers);
   
    let routes = root.or(ping_handler)
        .or(docker_status_handler)
        .or(docker_list_containers_handler)
        .with(cors().allow_any_origin());

    // let game_launch = warp::path!("game" / "launch")
    //     .and(warp::post())
    //     .map(game::game_launch);

    // // create a docker volume
    // docker_interactor::create_volume(
    //     "dillinger_main".to_string(),
    //     "local".to_string(),
    //     "/Users/iansorbello/Documents/docker_volumes/dillinger".to_string(),
    //     std::collections::HashMap::new(),
    // ).await;

    // Start the engine
    warp::serve(routes).run(([0, 0, 0, 0], port)).await;
}


/// Handler for the diagnostics ping route
async fn diagnostics_ping_handler() -> Result<impl warp::Reply, Infallible> {
    info!("route requested: diagnostics_ping_handler");
    let status = handlers::diagnostics::ping().await;
    Ok(warp::reply::with_status(status, StatusCode::OK))
}

/// Handler for the diagnostics docker status route
async fn diagnostics_docker_status_handler() -> Result<impl warp::Reply, Infallible> {
    info!("route requested: diagnostics_docker_status");
    let status = handlers::docker_interactor::get_docker_daemon_status().await;
    Ok(warp::reply::with_status(
        warp::reply::json(&status),
        StatusCode::OK,
    ))
}


async fn handler_list_containers() -> Result<impl warp::Reply, Infallible> {
    info!("route requested: running_containers");
    let containers = handlers::docker_interactor::list_running_containers().await;
    match containers {
        Ok(containers) => {
            Ok(warp::reply::with_status(warp::reply::json(&containers), StatusCode::OK))
        },
        Err(_) => Ok(warp::reply::with_status(warp::reply::json(&Vec::<DockerContainer>::new()), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}



