use std::sync::Arc;
use serde::Serialize;
use tokio::sync::Mutex;

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

#[cfg(not(target_os = "macos"))]
async fn monitor_devices() {
    let monitor = MonitorBuilder::new().unwrap()
        .match_subsystem("input").unwrap()
        .listen().unwrap();

    for event in monitor {
        if let Some(device) = event.device() {
            if let Some(devtype) = device.devtype() {
                if devtype == "keyboard" {
                    let manufacturer = device.property_value("ID_VENDOR_FROM_DATABASE").unwrap_or_default().to_string_lossy().to_string();
                    let product = device.property_value("ID_MODEL_FROM_DATABASE").unwrap_or_default().to_string_lossy().to_string();
                    let keyboard_info = KeyboardInfo { manufacturer, product };

                    let mut keyboards = KEYBOARDS.lock().unwrap();
                    match event.event_type() {
                        udev::EventType::Add => keyboards.push(keyboard_info),
                        udev::EventType::Remove => keyboards.retain(|k| k.product != product),
                        _ => (),
                    }
                }
            }
        }
    }
}