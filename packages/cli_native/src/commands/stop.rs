use anyhow::Result;

use crate::utils::{
    config::get_config,
    docker::{get_container_status, remove_container, stop_container},
    ui::LOG,
};

pub async fn stop_command(remove: bool) -> Result<()> {
    let config = get_config();
    let container_name = &config.container_name;
    let status = get_container_status(container_name).await?;

    if !status.exists {
        LOG.warn("Container does not exist.");
        return Ok(());
    }

    if status.running {
        stop_container(container_name).await?;
        LOG.success("Container stopped.");
    } else {
        LOG.warn("Container is already stopped.");
    }

    if remove {
        remove_container(container_name).await?;
        LOG.success("Container removed.");
    }

    Ok(())
}
