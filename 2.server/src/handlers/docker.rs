use core::convert::Infallible;
use dockworker::ContainerCreateOptions;
use dockworker::Docker;
use log::{info, error};
use std::fmt;

pub struct DockerStatus {
    pub daemon_up: bool,
}
#[derive(Debug)]
pub struct DockerRunParams {
    pub container_name: String,
    pub image_name: String,
    pub container_id: Option<String>,
}

#[derive(Debug)]
pub enum DockerError {
    StartError(String),
}

impl fmt::Display for DockerError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            DockerError::StartError(e) => write!(f, "Docker start error: {}", e),
            // Handle other kinds of errors as needed
        }
    }
}

impl std::error::Error for DockerError {}

pub async fn get_docker_daemon_status() -> Result<DockerStatus, Infallible> {
    let docker = Docker::connect_with_defaults().unwrap();
    let result = docker.ping().await;
    info!("Docker daemon status: {:?}", result);

    match result {
        Ok(()) => Ok(DockerStatus { daemon_up: true }),
        Err(..) => Ok(DockerStatus { daemon_up: false }),
    }
}

pub async fn docker_run_container(run_params: DockerRunParams) -> Result<(DockerRunParams), DockerError> {
    let docker = Docker::connect_with_defaults().unwrap();
    let mut create = ContainerCreateOptions::new(&run_params.container_name);
    create.tty(true);
    let container = docker
        .create_container(Some(&run_params.image_name), &create)
        .await
        .unwrap();

    match docker.start_container(&container.id).await {
        Ok(_) => {
            info!("Started Container {:?} with an ID of: {:?}", &run_params.container_name, &container.id);
            let mut run_params_out = run_params;
            run_params_out.container_id = Some(container.id);
            Ok(run_params_out)
        },
        Err(e) => {
            error!("Failed to start container: {:?}", e);
            Err(DockerError::StartError(format!("Failed to start container: {:?}", e)))
        }
    }
}

//
//

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_docker_run_container() {
        let result = docker_run_container(DockerRunParams {
            container_name: "hello-world".to_string(),
            image_name: "test_hello_world".to_string(),
            container_id: None,
        })
        .await;
        assert!(result.is_ok());
    }
}
