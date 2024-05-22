use axum::extract::Query;
use std::collections::HashMap;

use super::docker::get_docker_daemon_status;


pub async fn ping(Query(query): Query<HashMap<String, String>>) -> String {
    // Access the query string here using the `query` variable
    println!("Ping function executed - got the following query parameters: {:?}", query);
    "pong".to_string()
}

pub async fn docker_daemon_status(Query(_): Query<HashMap<String, String>>) -> String {
    get_docker_daemon_status().await.unwrap().daemon_up.to_string()
}
