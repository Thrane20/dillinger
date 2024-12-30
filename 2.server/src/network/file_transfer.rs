use reqwest::Url;
use serde::Serialize;
use std::{fs::File, path::{Component, PathBuf}, time::Instant};
use std::collections::HashMap;

#[derive(Clone, Serialize, Debug, PartialEq)]
pub enum FileTransferState { 
    NotStarted,
    InProgress,
    Completed,
    Failed
}

#[derive(Clone, Serialize, Debug)]
pub struct FileTransferStatus {
    pub state: FileTransferState,
    pub reason: String
}

impl FileTransferStatus {
    pub fn new() -> Self {
        FileTransferStatus {
            state: FileTransferState::NotStarted,
            reason: "".to_string()
        }
    }
}

#[derive(Clone, Serialize, Debug)]
pub struct FileTransfer {
    pub transfer_id: uuid::Uuid,
    pub remote_url: String,
    pub local_file: PathBuf,
    pub size: u64,
    pub chunks_added: u64,
    pub chunks_added_since: u64,
    pub transferred: u64,
    pub bandwidth: u128,
    pub status: FileTransferStatus    
}

impl FileTransfer {
    pub fn new() -> Self {
        FileTransfer {
            transfer_id: uuid::Uuid::new_v4(),
            remote_url: "".to_string(),
            local_file: PathBuf::new(),
            size: 0,
            chunks_added: 0,
            chunks_added_since: 0,
            transferred: 0,
            bandwidth: 0,
            status: FileTransferStatus {
                state: FileTransferState::NotStarted,
                reason: "Not Started".to_string()
            }
        }
    }
}

// This is used for messaging back to clients or connected systems
#[derive(Serialize)]
pub struct FileTransferMessage {
    component: String,
    pub file_transfers: Vec<FileTransfer>,
    pub total_bandwidth: u128
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
