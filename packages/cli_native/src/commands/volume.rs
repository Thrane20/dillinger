use anyhow::Result;

use crate::utils::{
    config::get_config,
    prompts::confirm,
    ui::LOG,
    volume::{
        backup_volume, create_bind_volume, create_docker_volume, list_volumes, remove_volume,
        restore_volume, verify_volume,
    },
};

pub async fn volume_create_command(bind: Option<&str>) -> Result<()> {
    let config = get_config();
    let volume_name = &config.volume_name;

    if let Some(host_path) = bind {
        create_bind_volume(volume_name, host_path).await?;
        LOG.success(&format!("Created bind volume {} -> {}", volume_name, host_path));
        return Ok(());
    }

    create_docker_volume(volume_name).await?;
    LOG.success(&format!("Created volume {}", volume_name));
    Ok(())
}

pub async fn volume_verify_command() -> Result<()> {
    let config = get_config();
    let volume_name = &config.volume_name;
    let result = verify_volume(volume_name).await;
    if result.ok {
        LOG.success(&format!("Volume {} verified.", volume_name));
        return Ok(());
    }
    LOG.error(&format!(
        "Volume verification failed: {}",
        result.reason.as_deref().unwrap_or("unknown reason")
    ));
    std::process::exit(1);
}

pub async fn volume_backup_command(file: &str) -> Result<()> {
    let config = get_config();
    let volume_name = &config.volume_name;
    backup_volume(volume_name, file).await?;
    LOG.success(&format!("Backed up {} to {}", volume_name, file));
    Ok(())
}

pub async fn volume_restore_command(file: &str) -> Result<()> {
    let config = get_config();
    let volume_name = &config.volume_name;
    restore_volume(volume_name, file).await?;
    LOG.success(&format!("Restored {} from {}", volume_name, file));
    Ok(())
}

pub async fn volume_destroy_command(force: bool) -> Result<()> {
    let config = get_config();
    let volume_name = &config.volume_name;

    let ok = if force {
        true
    } else {
        confirm(&format!("Remove volume {}?", volume_name), false)?
    };

    if !ok {
        LOG.warn("Volume removal cancelled.");
        return Ok(());
    }

    remove_volume(volume_name).await?;
    LOG.success(&format!("Removed {}", volume_name));
    Ok(())
}

pub async fn volume_list_command() -> Result<()> {
    let volumes = list_volumes(Some("dillinger")).await?;
    if volumes.is_empty() {
        LOG.warn("No dillinger volumes found.");
        return Ok(());
    }
    for name in &volumes {
        LOG.plain(name);
    }
    Ok(())
}
