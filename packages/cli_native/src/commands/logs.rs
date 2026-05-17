use anyhow::Result;

use crate::utils::{
    config::get_config,
    docker::{get_container_status, stream_logs},
    ui::LOG,
};

pub async fn logs_command(follow: bool, tail: &str) -> Result<()> {
    let config = get_config();
    let container_name = &config.container_name;
    let status = get_container_status(container_name).await?;

    if !status.exists {
        LOG.error("Dillinger container does not exist.");
        std::process::exit(1);
    }

    stream_logs(container_name, follow, tail).await
}
