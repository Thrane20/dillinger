#[macro_use]
extern crate lazy_static;

use crate::game_manager::GameCacheEntries;
use crate::handlers::docker_interactor::DockerContainer;
use config::MasterConfig;
use entities::game::Game;
use env_logger;
use gamedb::gamedb_search;
use log::info;
use scrapers::scrapers::{PlatformEntry, ScrapeEntry, Scraper};
use std::convert::Infallible;
use std::sync::{Arc, Mutex, MutexGuard};
use warp::cors;
use warp::http::StatusCode;
use warp::Filter; // For global initialization

pub mod config;
pub mod entities;
pub mod game;
pub mod game_manager;
pub mod gamedb;
pub mod handlers;
pub mod helpers;
pub mod platform;
pub mod scrapers;
pub mod system;

lazy_static! {
    // Find, load, and parse the master config file. This will panic if things aren't
    // correct. Nothing works without it; there is no graceful fallback
    static ref GLOBAL_CONFIG: Arc<MasterConfig> = config::get_master_config();
    static ref GAME_CACHE: Arc<Mutex<GameCacheEntries>> = Arc::new(Mutex::new(GameCacheEntries::from(Vec::new())));
}

#[tokio::main]
pub async fn main() {
    env_logger::init();

    match GLOBAL_CONFIG.root_dir.canonicalize() {
        Ok(absolute_path) => println!("Absolute path is {:?}", absolute_path),
        Err(e) => println!("Error resolving absolute path: {}", e),
    }

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

    // Game Management
    let build_game_cache =
        warp::path!("mgmt" / "build_game_cache").and_then(handler_build_game_cache);

    // Search local entries
    let search_local = warp::path!("search" / "local" / String).and_then(handler_search_local);

    // Search remote entries
    let search_remote =
        warp::path!("search" / "remote" / String / String).and_then(handler_search_remote);

    // Get details for a specific title
    let game_details =
        warp::path!("game" / "remote" / String / String).and_then(handler_get_game_details);

    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(handlers::socket_client::clients_filter.clone())
        .map(|ws: warp::ws::Ws, _clients| {
            ws.on_upgrade(move |socket| handlers::socket_client::client_connection(socket))
        });

    let routes = root
        .or(ping_handler)
        .or(docker_status_handler)
        .or(docker_list_containers_handler)
        .or(search_local)
        .or(search_remote)
        .or(game_details)
        .or(build_game_cache)
        .or(ws_route)
        .with(cors().allow_any_origin());

    // Prime the local search cache
    {
        let mut cache: MutexGuard<GameCacheEntries> = GAME_CACHE.lock().unwrap();
        cache.update(
            game_manager::prime_game_cache(0, GLOBAL_CONFIG.clone())
                .await
                .unwrap()
                .entries,
        )
    } // Cache lock will go out of scope and unlock here

    // Function to send a message to all WebSocket clients
    // async fn send_message_to_clients() {
    //     //handlers::socket_client::send_message("Hello from server!".to_string()).await;
    // }

    // Spawn a task to send messages to clients every 1 second
    // tokio::spawn(async move {
    //     loop {
    //         // Send the message to all WebSocket clients
    //         send_message_to_clients().await;
    //         // Wait for 1 second before sending the next message
    //         sleep(Duration::from_secs(1)).await;
    //     }
    // });

    // Assuming GameCacheEntries has an update method

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
    println!(
        "Dillinger server is running on port: {}",
        GLOBAL_CONFIG.port
    );
    warp::serve(routes)
        .run(([0, 0, 0, 0], GLOBAL_CONFIG.port))
        .await;
}

// fn with_clients(
//     clients: handlers::socket_client::Clients,
// ) -> impl Filter<Extract = (handlers::socket_client::Clients,), Error = Infallible> + Clone {
//     warp::any().map(move || clients.clone())
// }

async fn handler_build_game_cache() -> Result<impl warp::Reply, Infallible> {
    info!("route requested: handler_build_game_cache");
    tokio::task::spawn({
        let config = Arc::clone(&GLOBAL_CONFIG);
        async move {
            let _ = game_manager::build_game_cache(config).await;
        }
    });

    Ok(warp::reply::with_status(
        warp::reply::json(&serde_json::json!({ "result": "build_game_cache requested" })),
        StatusCode::OK,
    ))
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
        Ok(containers) => Ok(warp::reply::with_status(
            warp::reply::json(&containers),
            StatusCode::OK,
        )),
        Err(_) => Ok(warp::reply::with_status(
            warp::reply::json(&Vec::<DockerContainer>::new()),
            StatusCode::INTERNAL_SERVER_ERROR,
        )),
    }
}

async fn handler_search_local(search_term: String) -> Result<impl warp::Reply, Infallible> {
    info!("route requested: search_local");
    let cache: MutexGuard<GameCacheEntries> = GAME_CACHE.lock().unwrap();

    let results = cache
        .entries
        .iter()
        .filter(|entry| entry.slug.contains(&search_term))
        .collect::<Vec<&game_manager::GameCacheEntry>>();

    Ok(warp::reply::with_status(
        warp::reply::json(&results),
        StatusCode::OK,
    ))
}

async fn handler_search_remote(
    search_db: String,
    search_term: String,
) -> Result<impl warp::Reply, Infallible> {
    info!("route requested: search_remote");
    info!("search db: {}", search_db);
    info!("search term: {}", search_term);

    let mut results = vec![];

    let matching_titles = gamedb_search::search_title(search_db, search_term).await;
    match matching_titles {
        Ok(titles) => {
            results = titles;
        }
        Err(e) => {
            info!("Error searching remote: {}", e.description);
        }
    }

    Ok(warp::reply::with_status(
        warp::reply::json(&results),
        StatusCode::OK,
    ))
}

async fn handler_get_game_details(
    search_db: String,
    game_slug: String,
) -> Result<impl warp::Reply, Infallible> {
    info!("route requested: get_game_details");
    info!("search db: {}", search_db);
    info!("game slug: {}", game_slug);

    let mut game = Game::new();

    let matching_game = gamedb_search::get_game_details(search_db, game_slug).await;
    match matching_game {
        Ok(foundGame) => {
            game = foundGame.clone();
        }
        Err(e) => {
            info!("Error searching remote: {}", e.description);
        }
    }

    Ok(warp::reply::with_status(
        warp::reply::json(&game),
        StatusCode::OK,
    ))
}
