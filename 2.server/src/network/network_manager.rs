use super::file_transfer::{FileTransfer, FileTransferMessage};
use std::sync::Arc;
use rand::Rng;
use tokio::sync::Mutex;

lazy_static! {
    // Hold details of all files in active transfer
    static ref file_transfers: Arc<Mutex<Vec<FileTransfer>>> = Arc::new(Mutex::new(Vec::new()));
}

pub async fn get_file_transfers() -> FileTransferMessage {
    let ft_vec = file_transfers.lock().await;
    let mut result = Vec::new();
    let mut total_bandwidth: u32 = 0;
    for ft in ft_vec.iter() {
        total_bandwidth += ft.bandwidth;
        result.push(ft.clone());
    }
    let mut ftm = FileTransferMessage::new();
    ftm.file_transfers = result;
    ftm.total_bandwidth = total_bandwidth;
    ftm
}

pub async fn start_file_transfer() {
    // Placeholder
    let mut ft = FileTransfer::new();
    ft.file = "test.txt".to_string();
    ft.size = 0;
    ft.transferred = 0;
    ft.bandwidth = 0;

    
    let mut ft_vec = file_transfers.lock().await;
    ft_vec.push(ft);
}
