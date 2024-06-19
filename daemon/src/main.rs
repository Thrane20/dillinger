use dotenv::dotenv;
use std::env;
use warp::Filter;
use config::ConfigMain;
use data_store::DataStore;

pub mod config;
pub mod docker_interactor;
pub mod data_store;
pub mod game;

#[tokio::main]
async fn main() {

    dotenv().ok();

    // Get primary port from the .env file
    let port = match env::var_os("PORT") {
        Some(v) => v.into_string().unwrap(),
        None => "3031".to_string(),
    };
    

    // Find where to load the config file
    let config_dir = match env::var_os("CONFIG_DIR") {
        Some(v) => v.into_string().unwrap(),
        None => {
            eprintln!("ERROR: Environment variable CONFIG_DIR is not set.");
            std::process::exit(1);
        }
    };
 
    // Load and validate the config file
    let config_main = ConfigMain::load_from_file(&config_dir);
    if let Err(e) = config_main.validate_config() {
        eprintln!("ERROR: {}", e);
        std::process::exit(1);
    }
    let version = config_main.version();
    let data_dir = config_main.data_dir();
    println!("Working with version {:?} of the main config file", version.unwrap());
    println!("The data dir is: {}", data_dir.unwrap());

    // Test a save to the data store
    let data_store = DataStore::new("test".to_string());
    let result = data_store.test_save_db("/mnt/linuxfast/dillinger/data".to_string());
    
    let single_page_app = warp::get()
        .and(warp::path::end())
        .and(warp::fs::file("./dist/index.html"));

    let public_files = warp::fs::dir("./dist/");

    // Set up path handlers
    let docker_status_handler = warp::path!("docker_status").and_then(docker_interactor::get_docker_status);

    let routes = single_page_app.or(public_files);
    let routes = routes.or(warp::path!("test").map(|| "this is a test"));
    let routes = routes.or(docker_status_handler);
    let routes = routes.with(warp::log("warp::filters::fs"));

    let port = match port.parse::<u16>() { 
        Ok(p) => p, 
        Err(_) => panic!("Invalid port number")
    };

    let socket = std::net::SocketAddr::new(
        std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)),
        port
    );
    println!(
        "Dillinger Daemon is running at http://127.0.0.1:{}",
        socket.port()
    );
    warp::serve(routes).run(socket).await;
}
