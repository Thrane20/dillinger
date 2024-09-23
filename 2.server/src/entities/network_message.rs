use serde::{Deserialize, Serialize};

#[derive(serde::Serialize, serde::Deserialize)]
pub struct FileTransfer {
    pub file: String,
    pub file_size: u64,
    pub progress: u64,
    pub bandwidth: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct NetworkMessage {
    pub component: String,
    pub total_bandwidth: u64,
    pub files: Vec<FileTransfer>
}

impl Default for NetworkMessage {
    fn default() -> Self {
        Self {
            component: String::new(),
            total_bandwidth: 0,
            files: Vec::new()
        }
    }
}