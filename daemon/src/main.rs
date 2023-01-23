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
    
    let static_dir =
        warp::path("static").and(warp::fs::dir("../client/dist"));

    let hello = warp::path!("hello" / String)
        .map(|name| format!("Hello, {}!", name));

    let routes = static_dir.or(hello);

    let p = port.parse::<u16>().unwrap();


    let socket = std::net::SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)), p);
    println!("Dillinger Daemon is running at http://0.0.0.0:{}",socket.port());
    warp::serve(routes)
        .run(socket)
        .await;
}

// let log = warp::log("duploy::api");

// let ws = warp::path("ws")
//     .and(warp::ws())
//     .and(with_ctx(&app_ctx))
//     .and(warp::host::optional())
//     .map(|ws: warp::ws::Ws, app_ctx, authority| {
//         ws.on_upgrade(|socket| client_conn::client_connected(app_ctx, socket, authority))
//     });

// let static_dir =
//     warp::path("static").and(warp::fs::dir("../duploy_client/dist").recover(not_found));

// let login_redirect = warp::path!("login" / LoginProvider)
//     .and(warp::query())
//     .and(warp::host::optional())
//     .map(LoginProvider::handle);

// let other = warp::fs::file("../duploy_client/dist/index.html");

// let routes = static_dir.or(ws).or(login_redirect).or(other).with(log);

// warp::serve(routes).run(([127, 0, 0, 1], 3030)).await;
