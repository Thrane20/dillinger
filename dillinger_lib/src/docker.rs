use dockworker::Docker;
use tokio::runtime::Runtime;

pub async fn ping() -> bool {
    let docker = Docker::connect_with_defaults().unwrap();
    let result = docker.ping().await;
    
    match result {
        Ok(()) => true,
        Err(..) => false,
    }
}
