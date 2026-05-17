use anyhow::{Context, Result};
use std::process::Stdio;
use tokio::process::Command;

pub async fn create_docker_volume(volume_name: &str) -> Result<()> {
    let status = Command::new("docker")
        .args(["volume", "create", volume_name])
        .status()
        .await
        .context("docker volume create failed")?;
    if !status.success() {
        anyhow::bail!("docker volume create {} failed", volume_name);
    }
    Ok(())
}

pub async fn create_bind_volume(volume_name: &str, host_path: &str) -> Result<()> {
    let status = Command::new("docker")
        .args([
            "volume",
            "create",
            "--driver",
            "local",
            "--opt",
            "type=none",
            "--opt",
            &format!("device={}", host_path),
            "--opt",
            "o=bind",
            volume_name,
        ])
        .status()
        .await
        .context("docker volume create (bind) failed")?;
    if !status.success() {
        anyhow::bail!("docker volume create (bind) {} failed", volume_name);
    }
    Ok(())
}

pub async fn inspect_volume(volume_name: &str) -> Result<serde_json::Value> {
    let output = Command::new("docker")
        .args(["volume", "inspect", volume_name])
        .output()
        .await
        .context("docker volume inspect failed")?;
    let arr: Vec<serde_json::Value> =
        serde_json::from_slice(&output.stdout).context("parsing docker volume inspect output")?;
    Ok(arr.into_iter().next().unwrap_or(serde_json::Value::Null))
}

pub async fn volume_exists(volume_name: &str) -> bool {
    Command::new("docker")
        .args(["volume", "inspect", volume_name])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

pub async fn remove_volume(volume_name: &str) -> Result<()> {
    let status = Command::new("docker")
        .args(["volume", "rm", volume_name])
        .status()
        .await
        .context("docker volume rm failed")?;
    if !status.success() {
        anyhow::bail!("docker volume rm {} failed", volume_name);
    }
    Ok(())
}

pub async fn list_volumes(prefix: Option<&str>) -> Result<Vec<String>> {
    let output = Command::new("docker")
        .args(["volume", "ls", "--format", "{{.Name}}"])
        .output()
        .await
        .context("docker volume ls failed")?;
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|s| {
            if s.is_empty() {
                return false;
            }
            if let Some(pfx) = prefix {
                s.starts_with(pfx)
            } else {
                true
            }
        })
        .map(str::to_string)
        .collect())
}

pub async fn backup_volume(volume_name: &str, output_file: &str) -> Result<()> {
    let cwd = std::env::current_dir().context("getting cwd")?;
    let cwd_str = cwd.to_string_lossy();
    let status = Command::new("docker")
        .args([
            "run",
            "--rm",
            "-v",
            &format!("{}:/source:ro", volume_name),
            "-v",
            &format!("{}:/backup", cwd_str),
            "alpine",
            "sh",
            "-c",
            &format!("tar -czf /backup/{} -C /source .", output_file),
        ])
        .status()
        .await
        .context("docker run (backup) failed")?;
    if !status.success() {
        anyhow::bail!("volume backup failed");
    }
    Ok(())
}

pub async fn restore_volume(volume_name: &str, input_file: &str) -> Result<()> {
    let cwd = std::env::current_dir().context("getting cwd")?;
    let cwd_str = cwd.to_string_lossy();
    let status = Command::new("docker")
        .args([
            "run",
            "--rm",
            "-v",
            &format!("{}:/target", volume_name),
            "-v",
            &format!("{}:/backup", cwd_str),
            "alpine",
            "sh",
            "-c",
            &format!("tar -xzf /backup/{} -C /target", input_file),
        ])
        .status()
        .await
        .context("docker run (restore) failed")?;
    if !status.success() {
        anyhow::bail!("volume restore failed");
    }
    Ok(())
}

pub struct VerifyResult {
    pub ok: bool,
    pub reason: Option<String>,
}

pub async fn verify_volume(volume_name: &str) -> VerifyResult {
    match inspect_volume(volume_name).await {
        Ok(details) => {
            if details.get("Name").is_some() {
                VerifyResult {
                    ok: true,
                    reason: None,
                }
            } else {
                VerifyResult {
                    ok: false,
                    reason: Some("Volume metadata missing".to_string()),
                }
            }
        }
        Err(e) => VerifyResult {
            ok: false,
            reason: Some(e.to_string()),
        },
    }
}
