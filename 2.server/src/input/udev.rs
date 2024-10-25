use std::sync::Arc;
use serde::Serialize;
use tokio::sync::Mutex;
use udev::MonitorBuilder;

#[derive(Serialize, Clone)]
struct KeyboardInfo {
    manufacturer: String,
    product: String,
}

struct GamePadInfo {
    manufacturer: String,
    product: String,
}

lazy_static! {
    static ref KEYBOARDS: Arc<Mutex<Vec<KeyboardInfo>>> = Arc::new(Mutex::new(Vec::new()));
}

pub async fn monitor_devices() {
    let monitor = MonitorBuilder::new().unwrap()
        .match_subsystem("input").unwrap()
        .listen().unwrap();

    
}