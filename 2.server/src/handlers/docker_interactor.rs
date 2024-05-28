use bollard::{container::Config, container::ListContainersOptions, Docker};
use lazy_static::lazy_static;
use serde::Serialize;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;

lazy_static! {
    static ref DOCKER: Arc<Mutex<Docker>> =
        Arc::new(Mutex::new(Docker::connect_with_local_defaults().unwrap()));
}

pub async fn get_docker_daemon_status() -> DockerStatus {
    let docker = Arc::clone(&DOCKER);
    let docker = docker.lock().await;

    match docker.version().await {
        Ok(_) => DockerStatus {
            up_status: UpStatus::Up,
        },
        Err(..) => DockerStatus {
            up_status: UpStatus::Down,
        },
    }
}

pub async fn list_running_containers() -> Result<Vec<DockerContainer>, DockerError> {
    let docker = Arc::clone(&DOCKER);
    let docker = docker.lock().await;

    // Set up the filter for querying
    let mut list_container_filters = HashMap::new();
    list_container_filters.insert("status", vec!["running"]);

    let containers = docker
        .list_containers(Some(ListContainersOptions {
            all: true,
            filters: list_container_filters,
            ..Default::default()
        }))
        .await;

    // Iterate the container and copy into a DockerContainer struct
    let containers = match containers {
        Ok(containers) => containers
            .iter()
            .map(|container| DockerContainer {
                id: container.id.clone().unwrap_or("".to_string()),
                image: container.image.clone().unwrap_or("".to_string()),
            })
            .collect(),
        Err(e) => {
            return Err(DockerError {
                message: format!("Error listing containers: {:?}", e),
            })
        }
    };

    Ok(containers)
}

pub async fn docker_run(
    run_params: DockerRunParams,
) -> Result<DockerContainer, DockerError> {
    let docker = Arc::clone(&DOCKER);
    let docker = docker.lock().await;

    let alpine_config = Config {
        image: Some(run_params.image_name.clone()),
        tty: Some(true),
        ..Default::default()
    };

    let id = docker
    .create_container::<String, String>(None, alpine_config)
    .await
    .unwrap().id;

    let container = DockerContainer {
        id: id.clone(),
        image: run_params.image_name.clone(),
    };

    Ok(container)

}



#[derive(Serialize)]
pub enum UpStatus {
    Up,
    Down,
}

#[derive(Serialize)]
pub struct DockerStatus {
    pub up_status: UpStatus,
}

#[derive(Debug, Serialize)]
pub struct DockerError {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct DockerRunParams {
    pub image_name: String,
}

#[derive(Debug, Serialize)]
pub struct DockerExecResults {
    pub container_id: String,
    pub container_name: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct DockerContainer {
    pub id: String,
    pub image: String,
}
