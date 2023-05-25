use std::env;
use warp::Filter;
use dotenv::dotenv;

#[tokio::main]
async fn main() {

    dotenv().ok();

    let port = match env::var_os("PORT") {
        Some(v) => v.into_string().unwrap(),
        None => "3031".to_string()
    };
    
    let single_page_app = warp::get()
        .and(warp::path::end())
        .and(warp::fs::file("./dist/index.html"));

    let public_files = warp::fs::dir("./dist/");

    let hello = warp::path!("hello" / String)
        .map(|name| format!("Hello, {}!", name));

    // let routes = static_dir.or(hello).or(other);
    let routes = single_page_app.or(public_files).or(hello).with(warp::log("warp::filters::fs"));

    let p = port.parse::<u16>().unwrap();


    let socket = std::net::SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)), p);
    println!("Dillinger Daemon is running at http://127.0.0.1:{}",socket.port());
    warp::serve(routes)
        .run(socket)
        .await;
}
