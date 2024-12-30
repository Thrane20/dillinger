use crate::GLOBAL_CONFIG;

use super::file_transfer::{
    FileTransfer, FileTransferMessage, FileTransferState, FileTransferStatus,
};
use log::{debug, info};
use rand::Rng;
use reqwest::header::{CONTENT_LENGTH, RANGE};
use std::collections::HashMap;
use std::ffi::c_float;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{path::PathBuf, sync::Arc};
use tokio::fs;
use tokio::sync::MutexGuard;
use tokio::time::Instant;
use tokio::{io::AsyncWriteExt, sync::Mutex};
use warp::reject::MethodNotAllowed;

lazy_static! {
    // Hold details of all files in active transfer
    static ref file_transfers: Arc<Mutex<HashMap<uuid::Uuid,FileTransfer>>> = Arc::new(Mutex::new(HashMap::new()));
}

pub async fn acquire_file_transfers_map() -> MutexGuard<'static, HashMap<uuid::Uuid, FileTransfer>>
{
    debug!("Aquiring lock");
    let ft_map: MutexGuard<'_, HashMap<uuid::Uuid, FileTransfer>> = file_transfers.lock().await;
    debug!("Lock aquired");
    ft_map
}

pub async fn get_file_transfers_summary() -> FileTransferMessage {
    let mut ft_vec: Vec<FileTransfer> = Vec::new();
    {
        let ft_map = acquire_file_transfers_map().await;
        ft_vec = ft_map
            .values()
            .filter(|ft| ft.status.state == FileTransferState::InProgress)
            .cloned()
            .collect();
    } // The lock is released here

    let mut total_bandwidth: u128 = 0;
    let now = SystemTime::now();
    for ft in ft_vec.iter_mut() {
        let time_elapsed: u128 = now
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis()
            - ft.chunks_added_since as u128;
        if time_elapsed > 0 {
            let bandwidth = (ft.chunks_added as f64 * 1000.0) / (time_elapsed as f64 * 1024.0);
            ft.bandwidth = bandwidth as u128;
            total_bandwidth += ft.bandwidth;
        } else {
            total_bandwidth += 0;
        }
    }
    let mut ftm = FileTransferMessage::new();
    ftm.file_transfers = ft_vec.clone();
    ftm.total_bandwidth = total_bandwidth;
    ftm
}

pub async fn add_file_transfer(url: String, destination: PathBuf) -> uuid::Uuid {
    let mut ft = FileTransfer::new();
    ft.remote_url = url;
    ft.local_file = destination;
    ft.status = FileTransferStatus {
        state: FileTransferState::InProgress,
        reason: "".to_string(),
    };

    let transfer_id = ft.transfer_id.clone();
    let mut ft_map = file_transfers.lock().await;
    ft_map.insert(transfer_id, ft);
    info!("Added file transfer: {:?}", transfer_id);
    transfer_id
}

pub async fn remove_file_transfer(transfer_id: uuid::Uuid) {
    let mut ft_map = file_transfers.lock().await;
    ft_map.remove(&transfer_id);
}

pub async fn start_file_transfer(transfer_id: uuid::Uuid, remote_url: String) {
    // First, get the remote objects size before transfer
    let response = match reqwest::get(remote_url.clone()).await {
        Ok(resp) => resp,
        Err(e) => {
            let mut ft_map = acquire_file_transfers_map().await;
            let ft = ft_map.get_mut(&transfer_id).unwrap();
            ft.status = FileTransferStatus {
                state: FileTransferState::Failed,
                reason: format!("Error getting remote file (size): {:?}", e),
            };
            info!("{:?}", ft.status);
            return;
        }
    };
    let total_size = response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|ct_len| ct_len.to_str().ok())
        .and_then(|ct_len| ct_len.parse().ok())
        .unwrap_or(0);
    info!("Remote file size: {:?}", total_size);
    let mut ft_map = acquire_file_transfers_map().await;
    let ft = ft_map.get_mut(&transfer_id).unwrap();
    ft.size = total_size;
    let local_file = ft.local_file.clone();
    drop(ft_map);

    // Next, see if the local file exists and if so, its size
    let local_file_clone = local_file.clone();
    let local_file_size = if local_file.exists() {
        fs::metadata(local_file_clone).await.unwrap().len()
    } else {
        0
    };

    {
        info!("Local file size: {:?}", local_file_size);
        let mut ft_map = acquire_file_transfers_map().await;
        let ft = ft_map.get_mut(&transfer_id).unwrap();
        ft.transferred = local_file_size;
    }

    // Then, create or open the file for appending
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(local_file)
        .await
        .unwrap();

    // Finally, start the transfer
    let remote_url_clone = remote_url.clone();
    let client = reqwest::Client::new();
    let mut request = client.get(remote_url_clone);
    if local_file_size > 0 {
        request = request.header(RANGE, format!("bytes={}-", local_file_size));
    }

    let mut response = request.send().await.unwrap();
    if response.status().is_success() {
        let mut last_pass = Instant::now();
        let mut last_chunks: u64 = 0;
        while let Some(chunk) = response.chunk().await.unwrap() {
            file.write_all(&chunk).await.unwrap();
            last_chunks += chunk.len() as u64;
            // Test timing since our last check - update if in a new epoch
            let now = Instant::now();
            if now.duration_since(last_pass).as_millis() >= GLOBAL_CONFIG.chunking_interval as u128
            {
                last_pass = now;
                let mut ft_map = acquire_file_transfers_map().await;
                let ft = ft_map.get_mut(&transfer_id).unwrap();
                ft.transferred += last_chunks;
                ft.chunks_added = last_chunks;
                let since_the_epoch = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("Time went backwards");
                ft.chunks_added_since = since_the_epoch.as_millis() as u64;
                info!("actual chunk size: {:?}", ft.chunks_added);
                last_chunks = 0;
                debug!(
                    "Bytes received: {:?} / {:?} : {:.2}%",
                    ft.transferred,
                    ft.size,
                    (ft.transferred as f64 / ft.size as f64) * 100.0
                );
                drop(ft_map);
            }
        }

        {
            let mut ft_map = acquire_file_transfers_map().await;
            let ft = ft_map.get_mut(&transfer_id).unwrap();
            ft.status = FileTransferStatus {
                state: FileTransferState::Completed,
                reason: "".to_string(),
            };
        } // The lock is released here

        info!("File transfer complete: {:?}", transfer_id);
    }
}

pub async fn start_file_transfers() {
    let transfers: Vec<(uuid::Uuid, String)>;

    info!("Before the lock");
    {
        // Acquire the lock and collect the necessary data
        let ft_map = file_transfers.lock().await;
        transfers = ft_map
            .iter()
            .map(|(fttransfer_id, ft)| (fttransfer_id.clone(), ft.remote_url.clone()))
            .collect();
    } // The lock is released here
    info!("After the lock");

    for (fttransfer_id, remote_url) in transfers {
        info!("Starting file transfer: {:?}", fttransfer_id);
        // call start_file_transfer for each file transfer
        start_file_transfer(fttransfer_id, remote_url).await;
    }
}
