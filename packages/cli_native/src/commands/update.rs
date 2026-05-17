use anyhow::Result;

use crate::utils::{
    config::get_config,
    docker::ensure_image,
    prompts::confirm,
    ui::LOG,
    version::{compare_versions, fetch_remote_versions, get_local_image_version},
};

pub async fn update_check_command() -> Result<()> {
    let config = get_config();
    let remote = fetch_remote_versions().await;
    let local_image = get_local_image_version(&config.image_name)
        .await
        .ok()
        .flatten();

    let remote = match remote {
        Some(r) => r,
        None => {
            LOG.error("Unable to fetch remote versioning.env");
            std::process::exit(1);
        }
    };

    LOG.info(&format!("Remote core version: {}", remote.core_version));
    LOG.info(&format!("Remote script version: {}", remote.script_version));
    LOG.info(&format!(
        "Local image version: {}",
        local_image.as_deref().unwrap_or("not found")
    ));

    if local_image
        .as_ref()
        .map(|l| compare_versions(l, &remote.core_version) < 0)
        .unwrap_or(true)
    {
        LOG.warn("Docker image update available.");
    } else {
        LOG.success("Docker image is up to date.");
    }

    Ok(())
}

pub async fn update_apply_command(yes: bool) -> Result<()> {
    if yes {
        crate::utils::prompts::set_auto_yes(true);
    }

    let config = get_config();
    let remote = fetch_remote_versions().await;

    let remote = match remote {
        Some(r) => r,
        None => {
            LOG.error("Unable to fetch remote versioning.env");
            std::process::exit(1);
        }
    };

    let image_ref = format!("{}:{}", config.image_name, remote.core_version);
    let proceed = confirm(&format!("Pull {}?", image_ref), true)?;
    if !proceed {
        LOG.warn("Update cancelled.");
        return Ok(());
    }

    ensure_image(&image_ref).await?;
    LOG.success(&format!("Pulled {}", image_ref));
    Ok(())
}
