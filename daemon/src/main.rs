use dotenv::dotenv;
use std::env;
use warp::Filter;
use config::ConfigMain;

pub mod config;
pub mod docker_interactor;

#[tokio::main]
async fn main() {
    dotenv().ok();

    let port = match env::var_os("PORT") {
        Some(v) => v.into_string().unwrap(),
        None => "3031".to_string(),
    };

    let config_dir = match env::var_os("CONFIG_DIR") {
        Some(v) => v.into_string().unwrap(),
        None => {
            eprintln!("ERROR: Environment variable CONFIG_DIR is not set.");
            std::process::exit(1);
        }
    };

    let config_main = ConfigMain::load_from_file(&config_dir);
    let version = config_main.version();
    println!("Working with version {} of the main config file", version);
    
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
