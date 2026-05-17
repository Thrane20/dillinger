use anyhow::{Context, Result};
use std::process::Stdio;
use tokio::{fs, process::Command};

use crate::utils::constants::{UDEV_RULES_FILE, WOLF_UDEV_RULES};

pub async fn has_udev_rules_installed() -> bool {
    match fs::read_to_string(UDEV_RULES_FILE).await {
        Ok(content) => content.contains("Wolf Virtual Input Rules"),
        Err(_) => false,
    }
}

pub async fn install_udev_rules() -> Result<()> {
    // Try direct write first; fall back to sudo tee.
    match fs::write(UDEV_RULES_FILE, WOLF_UDEV_RULES).await {
        Ok(_) => {}
        Err(_) => {
            // Fallback: sudo tee
            let mut child = Command::new("sudo")
                .args(["tee", UDEV_RULES_FILE])
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .spawn()
                .context("sudo tee failed to spawn")?;
            use tokio::io::AsyncWriteExt;
            if let Some(stdin) = child.stdin.take() {
                let mut stdin = stdin;
                stdin.write_all(WOLF_UDEV_RULES.as_bytes()).await?;
            }
            let status = child.wait().await.context("sudo tee wait failed")?;
            if !status.success() {
                anyhow::bail!("sudo tee {} failed", UDEV_RULES_FILE);
            }
        }
    }

    let reload = Command::new("sudo")
        .args(["udevadm", "control", "--reload-rules"])
        .status()
        .await
        .context("udevadm reload failed")?;
    if !reload.success() {
        anyhow::bail!("udevadm control --reload-rules failed");
    }

    let trigger = Command::new("sudo")
        .args(["udevadm", "trigger"])
        .status()
        .await
        .context("udevadm trigger failed")?;
    if !trigger.success() {
        anyhow::bail!("udevadm trigger failed");
    }

    Ok(())
}
