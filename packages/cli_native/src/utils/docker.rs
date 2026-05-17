use anyhow::{Context, Result};
use serde::Deserialize;
use std::process::Stdio;
use tokio::process::Command;

#[derive(Debug, Clone, Default)]
pub struct ContainerStatus {
    pub exists: bool,
    pub running: bool,
    pub status: Option<String>,
    pub image: Option<String>,
    pub ports: Vec<String>,
    pub uptime: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DockerVolumeStatus {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub host_path: Option<String>,
    pub is_bind: bool,
}

pub async fn is_docker_installed() -> bool {
    Command::new("docker")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

pub async fn is_docker_running() -> bool {
    Command::new("docker")
        .arg("info")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

pub async fn has_docker_permissions() -> bool {
    Command::new("docker")
        .arg("ps")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

pub async fn container_exists(container_name: &str) -> bool {
    Command::new("docker")
        .args(["inspect", container_name])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

pub async fn get_container_status(container_name: &str) -> Result<ContainerStatus> {
    if !container_exists(container_name).await {
        return Ok(ContainerStatus {
            exists: false,
            running: false,
            ..Default::default()
        });
    }

    let format = [
        "{{.State.Running}}",
        "{{.State.Status}}",
        "{{.Config.Image}}",
        "{{.State.StartedAt}}",
        "{{json .NetworkSettings.Ports}}",
    ]
    .join("|");

    let output = Command::new("docker")
        .args(["inspect", "--format", &format, container_name])
        .output()
        .await
        .context("docker inspect failed")?;

    let raw = String::from_utf8_lossy(&output.stdout);
    let raw = raw.trim();

    // Split on the first 4 pipes only (ports JSON can contain pipes inside quotes —
    // but in practice the JSON doesn't have literal "|" chars, so a simple split
    // by the separator up to 5 parts works).
    let parts: Vec<&str> = raw.splitn(5, '|').collect();
    if parts.len() < 5 {
        return Ok(ContainerStatus {
            exists: true,
            running: false,
            ..Default::default()
        });
    }

    let running = parts[0] == "true";
    let status = parts[1].to_string();
    let image = parts[2].to_string();
    let started_at = parts[3].to_string();
    let ports_json = parts[4];

    let ports = parse_port_bindings(ports_json);

    Ok(ContainerStatus {
        exists: true,
        running,
        status: Some(status),
        image: Some(image),
        ports,
        uptime: Some(started_at),
    })
}

fn parse_port_bindings(json: &str) -> Vec<String> {
    #[derive(Deserialize)]
    struct Binding {
        #[serde(rename = "HostPort")]
        host_port: String,
    }

    let map: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    map.iter()
        .filter_map(|(container_port, bindings)| {
            let arr = bindings.as_array()?;
            if arr.is_empty() {
                return None;
            }
            let binding: Binding = serde_json::from_value(arr[0].clone()).ok()?;
            Some(format!("{}->{}", binding.host_port, container_port))
        })
        .collect()
}

pub async fn ensure_image(image_ref: &str) -> Result<()> {
    let status = Command::new("docker")
        .args(["pull", image_ref])
        .status()
        .await
        .context("docker pull failed")?;
    if !status.success() {
        anyhow::bail!("docker pull {} failed", image_ref);
    }
    Ok(())
}

pub async fn run_container(args: &[String]) -> Result<()> {
    let mut cmd_args: Vec<&str> = vec![];
    for a in args {
        cmd_args.push(a.as_str());
    }
    let status = Command::new("docker")
        .args(cmd_args)
        .status()
        .await
        .context("docker run failed")?;
    if !status.success() {
        anyhow::bail!("docker run failed");
    }
    Ok(())
}

pub async fn stop_container(container_name: &str) -> Result<()> {
    let status = Command::new("docker")
        .args(["stop", container_name])
        .status()
        .await
        .context("docker stop failed")?;
    if !status.success() {
        anyhow::bail!("docker stop {} failed", container_name);
    }
    Ok(())
}

pub async fn remove_container(container_name: &str) -> Result<()> {
    let status = Command::new("docker")
        .args(["rm", "-f", container_name])
        .status()
        .await
        .context("docker rm failed")?;
    if !status.success() {
        anyhow::bail!("docker rm {} failed", container_name);
    }
    Ok(())
}

pub async fn stream_logs(container_name: &str, follow: bool, tail: &str) -> Result<()> {
    let mut args = vec!["logs", "--tail", tail];
    if follow {
        args.push("--follow");
    }
    args.push(container_name);
    let status = Command::new("docker")
        .args(&args)
        .status()
        .await
        .context("docker logs failed")?;
    if !status.success() {
        anyhow::bail!("docker logs failed");
    }
    Ok(())
}

pub async fn check_network_reachable(host: &str) -> bool {
    Command::new("getent")
        .args(["hosts", host])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

pub async fn list_docker_volumes_detailed() -> Result<Vec<DockerVolumeStatus>> {
    let output = Command::new("docker")
        .args(["volume", "ls", "--format", "{{.Name}}"])
        .output()
        .await
        .context("docker volume ls failed")?;

    let names: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect();

    if names.is_empty() {
        return Ok(vec![]);
    }

    let mut inspect_args = vec!["volume", "inspect"];
    for name in &names {
        inspect_args.push(name.as_str());
    }
    let inspect_output = Command::new("docker")
        .args(&inspect_args)
        .output()
        .await
        .context("docker volume inspect failed")?;

    #[derive(Deserialize)]
    struct VolumeInspect {
        #[serde(rename = "Name", default)]
        name: String,
        #[serde(rename = "Driver", default)]
        driver: String,
        #[serde(rename = "Mountpoint", default)]
        mountpoint: String,
        #[serde(rename = "Options", default)]
        options: std::collections::HashMap<String, String>,
    }

    let parsed: Vec<VolumeInspect> =
        serde_json::from_slice(&inspect_output.stdout).context("parsing docker volume inspect")?;

    Ok(parsed
        .into_iter()
        .map(|v| {
            let opts = &v.options;
            let is_bind = opts.get("type").map(|t| t == "none").unwrap_or(false)
                && opts
                    .get("o")
                    .map(|o| o.split(',').any(|p| p == "bind"))
                    .unwrap_or(false);
            let host_path = if is_bind {
                opts.get("device").cloned()
            } else {
                None
            };
            DockerVolumeStatus {
                name: v.name,
                driver: v.driver,
                mountpoint: v.mountpoint,
                host_path,
                is_bind,
            }
        })
        .collect())
}
