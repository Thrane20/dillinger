use anyhow::Result;

use crate::utils::{
    prompts::confirm,
    udev::{has_udev_rules_installed, install_udev_rules},
    ui::LOG,
};

pub async fn udev_command() -> Result<()> {
    let installed = has_udev_rules_installed().await;
    if installed {
        LOG.success("Wolf udev rules already installed");
        return Ok(());
    }

    let proceed = confirm("Install Wolf udev rules?", true)?;
    if !proceed {
        LOG.warn("Skipped udev rules installation");
        return Ok(());
    }

    install_udev_rules().await?;
    LOG.success("Wolf udev rules installed and reloaded");
    Ok(())
}
