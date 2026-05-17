use anyhow::Result;
use std::path::Path;

use crate::utils::{
    config::get_config,
    docker::{
        check_network_reachable, has_docker_permissions, is_docker_installed, is_docker_running,
    },
    ui::LOG,
    volume::verify_volume,
};

fn print_check(name: &str, ok: bool, hint: Option<&str>) {
    if ok {
        LOG.success(name);
    } else {
        LOG.error(name);
        if let Some(h) = hint {
            LOG.info(&format!("  {}", h));
        }
    }
}

pub async fn doctor_command() -> Result<()> {
    let config = get_config();

    let docker_installed = is_docker_installed().await;
    let docker_running = if docker_installed {
        is_docker_running().await
    } else {
        false
    };
    let docker_perms = if docker_running {
        has_docker_permissions().await
    } else {
        false
    };

    print_check(
        "Docker installed",
        docker_installed,
        Some("Install Docker from docs.docker.com/get-docker"),
    );
    print_check(
        "Docker daemon running",
        docker_running,
        Some("Start Docker service"),
    );
    print_check(
        "Docker permissions",
        docker_perms,
        Some("Add user to docker group: sudo usermod -aG docker $USER"),
    );

    let gpu = Path::new("/dev/dri").exists();
    let pulse_socket = std::env::var("XDG_RUNTIME_DIR")
        .map(|d| Path::new(&d).join("pulse/native").exists())
        .unwrap_or(false);
    let display_set = std::env::var("DISPLAY").is_ok() || std::env::var("WAYLAND_DISPLAY").is_ok();

    print_check(
        "GPU device available",
        gpu,
        Some("GPU passthrough disabled if missing"),
    );
    print_check(
        "Audio socket available",
        pulse_socket,
        Some("PulseAudio may not be available"),
    );
    print_check(
        "Display environment available",
        display_set,
        Some("Set DISPLAY or WAYLAND_DISPLAY"),
    );

    let volume_result = verify_volume(&config.volume_name).await;
    print_check(
        "Volume integrity",
        volume_result.ok,
        volume_result.reason.as_deref(),
    );

    let ghcr = check_network_reachable("ghcr.io").await;
    print_check(
        "Network access to ghcr.io",
        ghcr,
        Some("Check DNS/network connectivity"),
    );

    Ok(())
}
