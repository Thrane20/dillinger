use anyhow::Result;

use crate::utils::{
    config::get_config,
    constants::{INSTALLED_VOLUME_PREFIX, STANDARD_VOLUMES},
    docker::{
        ensure_image, get_container_status, has_docker_permissions, is_docker_installed,
        is_docker_running, remove_container, run_container,
    },
    prompts::confirm,
    udev::{has_udev_rules_installed, install_udev_rules},
    ui::{create_spinner, LOG},
    version::{compare_versions, fetch_remote_versions, get_local_image_version},
    volume::{create_docker_volume, list_volumes, volume_exists},
};

#[derive(Debug, Clone)]
pub struct StartOptions {
    pub port: Option<u16>,
    pub detach: bool,
    pub no_update_check: bool,
    pub gpu: bool,
    pub audio: bool,
    pub display: bool,
    pub input: bool,
}

/// Builds the `docker run` argument list.  Pure function — testable without I/O.
pub fn build_start_docker_args(
    container_name: &str,
    core_volume_name: &str,
    selected_image: &str,
    host_port: u16,
    options: &StartOptions,
    extra_volumes: &[(String, String)],
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "run".into(),
        "--name".into(), container_name.into(),
        "-p".into(), format!("{}:3010", host_port),
        "-v".into(), "/var/run/docker.sock:/var/run/docker.sock".into(),
        "-v".into(), format!("{}:/data", core_volume_name),
        "--restart".into(), "unless-stopped".into(),
    ];

    for (name, mount) in extra_volumes {
        args.push("-v".into());
        args.push(format!("{}:{}", name, mount));
    }

    if options.gpu {
        args.push("--device".into());
        args.push("/dev/dri:/dev/dri".into());
    }

    if options.input {
        args.push("--device".into());
        args.push("/dev/input:/dev/input".into());
    }

    if options.audio {
        args.push("--device".into());
        args.push("/dev/snd:/dev/snd".into());
        args.push("-e".into());
        args.push(format!(
            "XDG_RUNTIME_DIR={}",
            std::env::var("XDG_RUNTIME_DIR").unwrap_or_default()
        ));
        args.push("-e".into());
        args.push(format!(
            "PULSE_SERVER={}",
            std::env::var("PULSE_SERVER").unwrap_or_default()
        ));
    }

    if options.display {
        args.push("-v".into());
        args.push("/tmp/.X11-unix:/tmp/.X11-unix:rw".into());
        args.push("-e".into());
        args.push(format!(
            "DISPLAY={}",
            std::env::var("DISPLAY").unwrap_or_else(|_| ":0".into())
        ));

        if let Ok(xauth) = std::env::var("XAUTHORITY") {
            args.push("-v".into());
            args.push(format!("{}:/tmp/.Xauthority:ro", xauth));
            args.push("-e".into());
            args.push("XAUTHORITY=/tmp/.Xauthority".into());
        }
    }

    if options.detach {
        args.push("-d".into());
    }

    args.push(selected_image.into());
    args
}

async fn ensure_standard_volume(name: &str) -> Result<()> {
    if !volume_exists(name).await {
        let spinner = create_spinner(&format!("Creating volume {}...", name));
        create_docker_volume(name).await?;
        spinner.finish_with_message(format!("Created volume {}", name));
    }
    Ok(())
}

async fn discover_installed_volumes() -> Vec<(String, String)> {
    let names = list_volumes(Some(INSTALLED_VOLUME_PREFIX))
        .await
        .unwrap_or_default();
    names
        .into_iter()
        .map(|name| {
            let suffix = name[INSTALLED_VOLUME_PREFIX.len()..].to_string();
            let mount = format!("/installed/{}", suffix);
            (name, mount)
        })
        .collect()
}

pub async fn start_command(options: StartOptions) -> Result<()> {
    let config = get_config();
    let container_name = config.container_name.clone();
    let volume_name = config.volume_name.clone();
    let image_name = config.image_name.clone();
    let host_port = options.port.unwrap_or(config.port);

    if !is_docker_installed().await {
        LOG.error("Docker is not installed.");
        std::process::exit(1);
    }
    if !is_docker_running().await {
        LOG.error("Docker daemon is not running.");
        std::process::exit(1);
    }
    if !has_docker_permissions().await {
        LOG.error("Docker permissions are missing for this user.");
        std::process::exit(1);
    }

    let udev_installed = has_udev_rules_installed().await;
    if !udev_installed {
        let should_install = confirm("Install Wolf udev rules now?", true)?;
        if should_install {
            install_udev_rules().await?;
            LOG.success("Installed Wolf udev rules.");
        }
    }

    // Ensure core volume.
    if !volume_exists(&volume_name).await {
        let spinner = create_spinner(&format!("Creating volume {}...", volume_name));
        create_docker_volume(&volume_name).await?;
        spinner.finish_with_message(format!("Created volume {}", volume_name));
    }

    // Ensure standard volumes.
    for (name, _) in STANDARD_VOLUMES {
        ensure_standard_volume(name).await?;
    }

    // Discover installed wine volumes.
    let installed_volumes = discover_installed_volumes().await;
    if !installed_volumes.is_empty() {
        LOG.info(&format!(
            "Mounting {} Wine install volume(s): {}",
            installed_volumes.len(),
            installed_volumes.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>().join(", ")
        ));
    }

    let extra_volumes: Vec<(String, String)> = STANDARD_VOLUMES
        .iter()
        .map(|(n, m)| (n.to_string(), m.to_string()))
        .chain(installed_volumes)
        .collect();

    // Container state check.
    let status = get_container_status(&container_name).await?;
    if status.running {
        LOG.warn(&format!("Container {} is already running.", container_name));
        return Ok(());
    }
    if status.exists {
        remove_container(&container_name).await?;
    }

    // Image selection.
    let mut selected_image = format!("{}:latest", image_name);

    if !options.no_update_check {
        let remote = fetch_remote_versions().await;
        let local = get_local_image_version(&image_name).await.ok().flatten();

        if let Some(ref remote) = remote {
            selected_image = format!("{}:{}", image_name, remote.core_version);

            if let Some(ref local) = local {
                if compare_versions(local, &remote.core_version) < 0 {
                    let should_update = confirm(
                        &format!(
                            "New image {} found (local {}). Pull now?",
                            remote.core_version, local
                        ),
                        true,
                    )?;
                    if !should_update {
                        selected_image = format!("{}:{}", image_name, local);
                    }
                }
            }
        } else if let Some(ref local) = local {
            selected_image = format!("{}:{}", image_name, local);
        }
    }

    let pull_spinner = create_spinner(&format!("Pulling {}...", selected_image));
    ensure_image(&selected_image).await?;
    pull_spinner.finish_with_message(format!("Pulled {}", selected_image));

    let docker_args = build_start_docker_args(
        &container_name,
        &volume_name,
        &selected_image,
        host_port,
        &options,
        &extra_volumes,
    );

    let run_spinner = create_spinner("Starting Dillinger container...");
    run_container(&docker_args).await?;
    run_spinner.finish_with_message(format!(
        "Dillinger started at http://localhost:{}",
        host_port
    ));

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_opts() -> StartOptions {
        StartOptions {
            port: None,
            detach: true,
            no_update_check: true,
            gpu: true,
            audio: true,
            display: true,
            input: true,
        }
    }

    #[test]
    fn includes_default_passthroughs() {
        let args = build_start_docker_args(
            "dillinger", "dillinger_core", "img:1.0.0", 3010,
            &default_opts(), &[],
        );
        assert!(args.iter().any(|a| a == "/dev/dri:/dev/dri"));
        assert!(args.iter().any(|a| a == "/dev/input:/dev/input"));
        assert!(args.iter().any(|a| a == "/dev/snd:/dev/snd"));
        assert!(args.iter().any(|a| a == "/tmp/.X11-unix:/tmp/.X11-unix:rw"));
        assert!(args.contains(&"-d".to_string()));
        assert_eq!(args.last().unwrap(), "img:1.0.0");
    }

    #[test]
    fn omits_disabled_passthroughs() {
        let opts = StartOptions {
            gpu: false, audio: false, display: false, input: false, detach: false,
            ..default_opts()
        };
        let args = build_start_docker_args(
            "dillinger", "dillinger_core", "img:1.0.0", 3010, &opts, &[],
        );
        let joined = args.join(" ");
        assert!(!joined.contains("/dev/dri:/dev/dri"));
        assert!(!joined.contains("/dev/input:/dev/input"));
        assert!(!joined.contains("/dev/snd:/dev/snd"));
        assert!(!joined.contains("/tmp/.X11-unix:/tmp/.X11-unix:rw"));
        assert!(!args.contains(&"-d".to_string()));
    }

    #[test]
    fn extra_volumes_are_mounted() {
        let extra = vec![("myvol".to_string(), "/mymount".to_string())];
        let args = build_start_docker_args(
            "dillinger", "dillinger_core", "img:1.0.0", 3010,
            &default_opts(), &extra,
        );
        let joined = args.join(" ");
        assert!(joined.contains("myvol:/mymount"));
    }
}
