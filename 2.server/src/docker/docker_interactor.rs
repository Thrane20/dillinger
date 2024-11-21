use bollard::{
    container::{Config, CreateContainerOptions, ListContainersOptions, StartContainerOptions},
    exec::{CreateExecOptions, StartExecResults},
    volume::CreateVolumeOptions,
    Docker,
    API_DEFAULT_VERSION
};
use lazy_static::lazy_static;
use log::{debug, info};
use serde::Serialize;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;

use super::volumes::DockerVolume;
use super::volumes::VolumeContents;
use crate::helpers::docker_run_params::DockerRunParams;

// lazy_static! {
//     static ref DOCKER: Arc<Mutex<Docker>> =
//         Arc::new(Mutex::new(Docker::connect_with_local_defaults().unwrap()));
// }

const PODMAN_SOCKET:&str = "unix:///run/user/1000/podman/podman.sock";

lazy_static! {
    static ref DOCKER: Arc<Mutex<Docker>> =
        Arc::new(Mutex::new(Docker::connect_with_unix(PODMAN_SOCKET, 120, API_DEFAULT_VERSION).unwrap()));
}

pub async fn get_docker_daemon_status() -> DockerStatus {
    info!("checking docker");
    let docker = Arc::clone(&DOCKER);
    let docker = docker.lock().await;

    match docker.version().await {
        Ok(_) => { info!("docker is up");
        DockerStatus {
            up_status: UpStatus::Up,
        }},
        Err(..) => {
            info!("got a docker error");
            DockerStatus {
            up_status: UpStatus::Down,
        }},
    }
}

pub async fn list_named_volumes() -> Result<Vec<DockerVolume>, DockerError> {
    let docker = Arc::clone(&DOCKER);
    let docker = docker.lock().await;

    let volumes = docker.list_volumes::<String>(None).await;

    match volumes {
        Ok(volumes) => {
            let volumes = volumes
                .volumes
                .unwrap()
                .iter()
                .map(|volume| DockerVolume {
                    name: volume.name.clone(),
                })
                .collect();

            Ok(volumes)
        }
        Err(e) => {
            debug!("Error listing volumes: {:?}", e.to_string());
            return Err(DockerError {
                message: format!("Error listing volumes: {:?}", e.to_string()),
            });
        }
    }
}

pub async fn get_volume_contents(
    volume_name: String,
    path: String,
) -> Result<Vec<VolumeContents>, DockerError> {
    let docker = Arc::clone(&DOCKER);
    let docker = docker.lock().await;

    let volumes = docker.list_volumes::<String>(None).await;

    // Create a container with the volume mounted
    let container_name = "dillinger_volume_reader";
    let config = Config {
        image: Some("alpine"),
        volumes: Some(HashMap::from([(volume_name.as_str(), HashMap::new())])),
        ..Default::default()
    };

    let container = docker
        .create_container(
            Some(CreateContainerOptions {
                name: container_name,
                platform: Some("linux".to_string().as_str()),
            }),
            config,
        )
        .await;

    docker
        .start_container(container_name, None::<StartContainerOptions<String>>)
        .await;

    let exec = docker
        .create_exec(
            container_name,
            CreateExecOptions {
                attach_stdout: Some(true),
                attach_stderr: Some(true),
                cmd: Some(vec!["ls", "-1", &format!("/{}", volume_name)]),
                ..Default::default()
            },
        )
        .await;

    // // Start the exec instance and capture the output
    // let mut exec_stream = docker.start_exec(&exec.id, None).await;

    let mut contents = Vec::new();
    Ok(contents)
}


/// Create a volume mount with the given name, driver, host path and labels
/// This is desribed as a volume mount, as it's a volume that is mounted to a 
/// specific path on the host (not docker managed)
pub async fn create_volume_mount(
    name: String,
    driver: String,
    host_path: String,
    labels: HashMap<String, String>,
) -> Result<(), bollard::errors::Error> {
    let docker = Docker::connect_with_local_defaults().unwrap();

    let mut driver_opts = HashMap::new();
    driver_opts.insert("type".to_string(), "none".to_string());
    driver_opts.insert("device".to_string(), host_path);
    driver_opts.insert("o".to_string(), "bind".to_string());

    let options = CreateVolumeOptions {
        name,
        driver,
        driver_opts,
        labels,
    };

    match docker.create_volume(options).await {
        Ok(_) => Ok(()),
        Err(e) => Err(e),
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

pub async fn docker_run(run_params: DockerRunParams) -> Result<DockerContainer, DockerError> {
    let docker = Arc::clone(&DOCKER);
    let docker = docker.lock().await;
    let mut volumes = HashMap::new();
    volumes.insert("/tmp:/tmp".to_string(), HashMap::new());

    let alpine_config = Config {
        image: Some(run_params.image_name.clone()),
        tty: run_params.tty,
        cmd: Some(vec!["/bin/sh".to_string()]),
        volumes: Some(volumes),
        ..Default::default()
    };

    let id = docker
        .create_container::<String, String>(None, alpine_config)
        .await
        .unwrap()
        .id;

    match docker.start_container::<String>(&id, None).await {
        Ok(_) => {
            docker
                .create_exec(
                    &id,
                    CreateExecOptions {
                        attach_stdout: Some(true),
                        attach_stderr: Some(true),
                        attach_stdin: Some(true),
                        tty: Some(true),
                        cmd: Some(vec!["/bin/sh"]),
                        ..Default::default()
                    },
                )
                .await
                .unwrap()
                .id;

            let container = DockerContainer {
                id: id.clone(),
                image: run_params.image_name.clone(),
            };

            Ok(container)
        }
        Err(e) => {
            return Err(DockerError {
                message: format!("Error starting container: {:?}", e),
            })
        }
    }
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

#[derive(Debug, Serialize, Clone)]
pub struct DockerError {
    pub message: String,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_list_named_volumes() {
        let result = list_named_volumes().await;
        // iterate the result and print the volumes
        match result {
            Ok(volumes) => {
                for volume in volumes {
                    println!("Volume: {}", volume.name);
                }

                assert!(true);
            }
            Err(e) => {
                println!("Error: {:?}", e);
                assert!(false);
            }
        }
    }
}
