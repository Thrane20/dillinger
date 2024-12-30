use crate::network::{
    file_transfer::FileTransfer,
    network_manager,
};
use crate::GLOBAL_CONFIG;
use std::collections::HashMap;
use std::sync::Arc;
use log::info;
use tokio::sync::Mutex;
use uuid::Uuid;

use std::sync::Once;

static INIT: Once = Once::new();

fn init_logger() {
    INIT.call_once(|| {
        env_logger::init();
    });
}

#[tokio::test]
async fn test_add_file_transfer() {
    init_logger();
    let transfer = FileTransfer::new();
    info!("Running test_add_file_transfer {:?}", transfer);
    // create a path buf to
    let path = std::path::PathBuf::from("/tmp/testfile.txt");
    network_manager::add_file_transfer("https://releases.ubuntu.com/24.10/ubuntu-24.10-desktop-amd64.iso".to_string(), path).await;
    network_manager::start_file_transfers().await;

    assert!(true);
}

#[tokio::test]
async fn basic() {
    init_logger();
    info!("Running basic test");
    assert!(true);
}

#[tokio::test]
async fn deserialize_config() {
    init_logger();
    info!("Running config deserializer");
    let config = GLOBAL_CONFIG.root_dir.clone();
    assert!(true);
}
