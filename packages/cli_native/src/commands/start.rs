use anyhow::Result;
use std::path::{Path, PathBuf};

use crate::utils::{
    config::get_config,
    constants::{
        DEFAULT_DOWNLOAD_CACHE_VOLUME_NAME, DEFAULT_ROMS_VOLUME_NAME, INSTALLED_VOLUME_PREFIX,
    },
    docker::{
        ensure_image, get_container_status, has_docker_permissions, is_docker_installed,
        is_docker_running, remove_container, run_container,
    },
    managed_volumes::{list_managed_volumes, ManagedVolumePurpose, ManagedVolumeRecord},
    prompts::confirm,
    udev::{has_udev_rules_installed, install_udev_rules},
    ui::{create_spinner, LOG},
    version::{compare_versions, fetch_remote_versions, get_local_image_version},
    volume::{create_bind_volume, create_docker_volume, list_volumes, volume_exists},
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

fn push_env_arg(args: &mut Vec<String>, key: &str, value: &str) {
    if value.is_empty() {
        return;
    }
    args.push("-e".into());
    args.push(format!("{}={}", key, value));
}

fn push_bind_arg(args: &mut Vec<String>, source: &Path, target: &Path, mode: &str) {
    if !source.exists() {
        return;
    }
    args.push("-v".into());
    args.push(format!(
        "{}:{}:{}",
        source.to_string_lossy(),
        target.to_string_lossy(),
        mode
    ));
}

fn push_device_arg(args: &mut Vec<String>, device_path: &str) {
    args.push("--device".into());
    args.push(format!("{}:{}", device_path, device_path));
}

fn pulse_socket_path_from_server(pulse_server: &str) -> Option<PathBuf> {
    let value = pulse_server.trim();
    if let Some(path) = value.strip_prefix("unix:") {
        return Some(PathBuf::from(path));
    }
    if value.starts_with('/') {
        return Some(PathBuf::from(value));
    }
    None
}

fn append_audio_passthrough(args: &mut Vec<String>) {
    push_device_arg(args, "/dev/snd");

    let xdg_runtime_dir = std::env::var("XDG_RUNTIME_DIR")
        .ok()
        .filter(|v| !v.is_empty());
    let pulse_server = std::env::var("PULSE_SERVER").ok().filter(|v| !v.is_empty());

    if let Some(xdg_runtime_dir) = xdg_runtime_dir.as_deref() {
        let runtime_path = Path::new(xdg_runtime_dir);
        push_bind_arg(args, runtime_path, runtime_path, "rw");
        push_env_arg(args, "XDG_RUNTIME_DIR", xdg_runtime_dir);
    }

    let resolved_pulse_server = pulse_server.or_else(|| {
        xdg_runtime_dir.as_ref().and_then(|runtime_dir| {
            let socket = Path::new(runtime_dir).join("pulse/native");
            if socket.exists() {
                Some(format!("unix:{}", socket.to_string_lossy()))
            } else {
                None
            }
        })
    });

    if let Some(pulse_server) = resolved_pulse_server.as_deref() {
        push_env_arg(args, "PULSE_SERVER", pulse_server);
        if let Some(socket_path) = pulse_socket_path_from_server(pulse_server) {
            if let Some(socket_dir) = socket_path.parent() {
                push_bind_arg(args, socket_dir, socket_dir, "rw");
            }
        }
    }

    let home = std::env::var("HOME").ok().filter(|v| !v.is_empty());
    let mut cookie_candidates = Vec::new();
    if let Some(home) = home {
        cookie_candidates.push(PathBuf::from(home).join(".config/pulse/cookie"));
    }
    cookie_candidates.push(PathBuf::from("/home/dillinger/.config/pulse/cookie"));

    if let Some(cookie_path) = cookie_candidates.into_iter().find(|path| path.exists()) {
        if let Some(cookie_dir) = cookie_path.parent() {
            push_bind_arg(args, cookie_dir, Path::new("/root/.config/pulse"), "ro");
        }
        push_env_arg(args, "PULSE_COOKIE", "/root/.config/pulse/cookie");
    }
}

/// Builds the `docker run` argument list.  Pure function — testable without I/O.
pub fn build_start_docker_args(
    container_name: &str,
    core_mount_source: &str,
    selected_image: &str,
    host_port: u16,
    options: &StartOptions,
    extra_volumes: &[(String, String)],
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "run".into(),
        "--init".into(),
        "--name".into(),
        container_name.into(),
        "--network=host".into(),
        "--ipc=host".into(),
        "-e".into(),
        format!("PORT={}", host_port),
        "-v".into(),
        "/var/run/docker.sock:/var/run/docker.sock".into(),
        "-v".into(),
        format!("{}:/data", core_mount_source),
        "--restart".into(),
        "unless-stopped".into(),
    ];

    for (name, mount) in extra_volumes {
        args.push("-v".into());
        args.push(format!("{}:{}", name, mount));
    }

    if options.gpu {
        push_device_arg(&mut args, "/dev/dri");
    }

    if options.input {
        push_device_arg(&mut args, "/dev/input");
        push_device_arg(&mut args, "/dev/uinput");
        push_device_arg(&mut args, "/dev/bus/usb");
        push_bind_arg(
            &mut args,
            Path::new("/run/udev"),
            Path::new("/run/udev"),
            "ro",
        );
    }

    if options.audio {
        append_audio_passthrough(&mut args);
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

pub async fn ensure_volume_exists_from_record(record: &ManagedVolumeRecord) -> Result<()> {
    if !volume_exists(&record.docker_volume_name).await {
        let spinner = create_spinner(&format!(
            "Creating bind-backed volume {}...",
            record.docker_volume_name
        ));
        create_bind_volume(&record.docker_volume_name, &record.host_path).await?;
        spinner.finish_with_message(format!(
            "Created bind-backed volume {} -> {}",
            record.docker_volume_name, record.host_path
        ));
    }
    Ok(())
}

pub async fn ensure_named_volume(name: &str) -> Result<()> {
    if !volume_exists(name).await {
        let managed = list_managed_volumes()
            .await
            .unwrap_or_default()
            .into_iter()
            .find(|volume| volume.docker_volume_name == name);

        let spinner = create_spinner(&format!("Creating volume {}...", name));
        if let Some(managed) = managed {
            create_bind_volume(name, &managed.host_path).await?;
            spinner.finish_with_message(format!(
                "Created bind-backed volume {} -> {}",
                name, managed.host_path
            ));
        } else {
            create_docker_volume(name).await?;
            spinner.finish_with_message(format!("Created volume {}", name));
        }
    }
    Ok(())
}

fn managed_by_purpose(
    volumes: &[ManagedVolumeRecord],
    purpose: ManagedVolumePurpose,
) -> Vec<ManagedVolumeRecord> {
    volumes
        .iter()
        .filter(|volume| volume.status == "active" && volume.purpose == Some(purpose.clone()))
        .cloned()
        .collect()
}

fn installed_mount_suffix(volume: &ManagedVolumeRecord) -> String {
    let source = volume
        .docker_volume_name
        .strip_prefix(INSTALLED_VOLUME_PREFIX)
        .unwrap_or(volume.name.as_str());
    let suffix: String = source
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    if suffix.is_empty() {
        "default".to_string()
    } else {
        suffix
    }
}

pub async fn resolve_configured_mounts(
    configured_core_volume: &str,
) -> Result<(String, Vec<(String, String)>)> {
    let managed = list_managed_volumes().await.unwrap_or_default();

    let core_source = if let Some(core) = managed_by_purpose(&managed, ManagedVolumePurpose::Core)
        .into_iter()
        .next()
    {
        ensure_volume_exists_from_record(&core).await?;
        LOG.info(&format!(
            "Using Dillinger Core storage {} -> /data",
            core.docker_volume_name
        ));
        core.docker_volume_name
    } else {
        ensure_named_volume(configured_core_volume).await?;
        LOG.info(&format!(
            "Using Dillinger Core storage {} -> /data",
            configured_core_volume
        ));
        configured_core_volume.to_string()
    };

    let mut extra = Vec::new();

    if let Some(roms) = managed_by_purpose(&managed, ManagedVolumePurpose::Roms)
        .into_iter()
        .next()
    {
        ensure_volume_exists_from_record(&roms).await?;
        LOG.info(&format!(
            "Using ROM library {} -> /roms",
            roms.docker_volume_name
        ));
        extra.push((roms.docker_volume_name, "/roms".to_string()));
    } else {
        ensure_named_volume(DEFAULT_ROMS_VOLUME_NAME).await?;
        extra.push((DEFAULT_ROMS_VOLUME_NAME.to_string(), "/roms".to_string()));
    }

    let download_cache = managed_by_purpose(&managed, ManagedVolumePurpose::Cache)
        .into_iter()
        .next()
        .or_else(|| {
            managed_by_purpose(&managed, ManagedVolumePurpose::Downloads)
                .into_iter()
                .next()
        });
    if let Some(cache) = download_cache {
        ensure_volume_exists_from_record(&cache).await?;
        LOG.info(&format!(
            "Using download cache {} -> /cache",
            cache.docker_volume_name
        ));
        extra.push((cache.docker_volume_name, "/cache".to_string()));
    } else {
        ensure_named_volume(DEFAULT_DOWNLOAD_CACHE_VOLUME_NAME).await?;
        extra.push((
            DEFAULT_DOWNLOAD_CACHE_VOLUME_NAME.to_string(),
            "/cache".to_string(),
        ));
    }

    for installed in managed_by_purpose(&managed, ManagedVolumePurpose::Installed) {
        ensure_volume_exists_from_record(&installed).await?;
        let suffix = installed_mount_suffix(&installed);
        extra.push((
            installed.docker_volume_name,
            format!("/installed/{}", suffix),
        ));
    }

    let legacy_installed = discover_legacy_installed_volumes().await;
    let mut existing_names: std::collections::HashSet<String> =
        extra.iter().map(|(name, _)| name.clone()).collect();
    for (name, mount) in legacy_installed {
        if existing_names.insert(name.clone()) {
            extra.push((name, mount));
        }
    }

    Ok((core_source, extra))
}

async fn discover_legacy_installed_volumes() -> Vec<(String, String)> {
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

    let (core_mount_source, extra_volumes) = resolve_configured_mounts(&volume_name).await?;
    let installed_count = extra_volumes
        .iter()
        .filter(|(_, mount)| mount.starts_with("/installed/"))
        .count();
    if installed_count > 0 {
        LOG.info(&format!(
            "Mounting {} install volume(s): {}",
            installed_count,
            extra_volumes
                .iter()
                .filter(|(_, mount)| mount.starts_with("/installed/"))
                .map(|(n, _)| n.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

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
        &core_mount_source,
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
            "dillinger",
            "dillinger_core",
            "img:1.0.0",
            3010,
            &default_opts(),
            &[],
        );
        assert!(args.iter().any(|a| a == "/dev/dri:/dev/dri"));
        assert!(args.iter().any(|a| a == "/dev/input:/dev/input"));
        assert!(args.iter().any(|a| a == "/dev/uinput:/dev/uinput"));
        assert!(args.iter().any(|a| a == "/dev/bus/usb:/dev/bus/usb"));
        assert!(args.iter().any(|a| a == "/dev/snd:/dev/snd"));
        assert!(args.iter().any(|a| a == "/tmp/.X11-unix:/tmp/.X11-unix:rw"));
        assert!(args.iter().any(|a| a == "--init"));
        assert!(args.iter().any(|a| a == "--network=host"));
        assert!(args.iter().any(|a| a == "--ipc=host"));
        assert!(args.iter().any(|a| a == "PORT=3010"));
        assert!(args.contains(&"-d".to_string()));
        assert_eq!(args.last().unwrap(), "img:1.0.0");
    }

    #[test]
    fn omits_disabled_passthroughs() {
        let opts = StartOptions {
            gpu: false,
            audio: false,
            display: false,
            input: false,
            detach: false,
            ..default_opts()
        };
        let args =
            build_start_docker_args("dillinger", "dillinger_core", "img:1.0.0", 3010, &opts, &[]);
        let joined = args.join(" ");
        assert!(!joined.contains("/dev/dri:/dev/dri"));
        assert!(!joined.contains("/dev/input:/dev/input"));
        assert!(!joined.contains("/dev/uinput:/dev/uinput"));
        assert!(!joined.contains("/dev/bus/usb:/dev/bus/usb"));
        assert!(!joined.contains("/dev/snd:/dev/snd"));
        assert!(!joined.contains("/tmp/.X11-unix:/tmp/.X11-unix:rw"));
        assert!(!args.contains(&"-d".to_string()));
    }

    #[test]
    fn extra_volumes_are_mounted() {
        let extra = vec![("myvol".to_string(), "/mymount".to_string())];
        let args = build_start_docker_args(
            "dillinger",
            "dillinger_core",
            "img:1.0.0",
            3010,
            &default_opts(),
            &extra,
        );
        let joined = args.join(" ");
        assert!(joined.contains("myvol:/mymount"));
    }
}
