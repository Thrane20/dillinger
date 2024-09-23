use serde::Serialize;
use std::{fs::File, path::Component};

#[derive(Clone, Serialize)]
pub struct FileTransfer {
    pub file: String,
    pub size: u64,
    pub transferred: u64,
    pub bandwidth: u32,
}

impl FileTransfer {
    pub fn new() -> Self {
        FileTransfer {
            file: String::new(),
            size: 0,
            transferred: 0,
            bandwidth: 0,
        }
    }
}

// This is used for messaging back to clients or connected systems
#[derive(Serialize)]
pub struct FileTransferMessage {
    component: String,
    pub file_transfers: Vec<FileTransfer>,
    pub total_bandwidth: u32
}

impl FileTransferMessage {
    pub fn new() -> Self {
        FileTransferMessage {
            component: "network".to_string(),
            file_transfers: Vec::new(),
            total_bandwidth: 0
        }
    }
}
