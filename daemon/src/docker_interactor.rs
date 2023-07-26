use serde::{Serialize, Deserialize};
use dillinger_lib::{ self, docker };
use std::convert::Infallible;
use warp;

#[derive(Clone, Serialize, Deserialize)]
pub struct DockerStatus {
    pub is_up: bool,
}


pub async fn get_docker_status() -> Result<impl warp::Reply, Infallible> {
    let result = docker::ping().await;
    let result = match result {
        true => DockerStatus { is_up: true },
        false => DockerStatus { is_up: false },
    };
    Ok(warp::reply::json(&result))
}
