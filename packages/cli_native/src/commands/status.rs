use anyhow::Result;

use crate::utils::{
    config::get_config,
    docker::get_container_status,
    ui::LOG,
};

pub async fn status_command() -> Result<()> {
    let config = get_config();
    let container_name = &config.container_name;
    let status = get_container_status(container_name).await?;

    if !status.exists {
        LOG.warn("Dillinger container is not created.");
        return Ok(());
    }

    LOG.plain(&format!("Container: {}", container_name));
    LOG.plain(&format!("State: {}", if status.running { "running" } else { "stopped" }));
    if let Some(ref s) = status.status {
        LOG.plain(&format!("Status: {}", s));
    }
    if let Some(ref image) = status.image {
        LOG.plain(&format!("Image: {}", image));
    }
    if let Some(ref uptime) = status.uptime {
        LOG.plain(&format!("Started: {}", uptime));
    }
    if !status.ports.is_empty() {
        LOG.plain(&format!("Ports: {}", status.ports.join(", ")));
    }

    Ok(())
}
