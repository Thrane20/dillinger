use anyhow::Result;

use crate::{
    commands::{
        start::{start_command, StartOptions},
        stop::stop_command,
    },
    utils::config::get_config,
};

pub async fn restart_command() -> Result<()> {
    let port = get_config().port;
    stop_command(true).await?;
    start_command(StartOptions {
        port: Some(port),
        detach: true,
        no_update_check: false,
        gpu: true,
        audio: true,
        display: true,
        input: true,
    })
    .await
}
