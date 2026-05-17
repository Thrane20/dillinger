use anyhow::Result;
use clap::{Parser, Subcommand};

mod commands;
mod tui;
mod utils;

use commands::{
    config::{config_reset_command, config_set_command, config_show_command},
    doctor::doctor_command,
    logs::logs_command,
    restart::restart_command,
    start::{start_command, StartOptions},
    status::status_command,
    stop::stop_command,
    udev::udev_command,
    update::{update_apply_command, update_check_command},
    volume::{
        volume_backup_command, volume_create_command, volume_destroy_command, volume_list_command,
        volume_restore_command, volume_verify_command,
    },
};
use utils::prompts::set_auto_yes;

// ── CLI shape ─────────────────────────────────────────────────────────────────

#[derive(Debug, Parser)]
#[command(
    name = "dillinger-gaming",
    version,
    about = "Dillinger Gaming — self-hosted game streaming manager"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Auto-confirm every interactive prompt
    #[arg(short = 'y', long, global = true)]
    yes: bool,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Start the Dillinger container
    Start {
        /// Host port to bind (default: from config)
        #[arg(short, long)]
        port: Option<u16>,
        /// Attached mode — do not detach from container
        #[arg(long)]
        no_detach: bool,
        /// Skip update check on start
        #[arg(long)]
        no_update_check: bool,
        /// Disable GPU passthrough
        #[arg(long)]
        no_gpu: bool,
        /// Disable audio passthrough
        #[arg(long)]
        no_audio: bool,
        /// Disable display passthrough
        #[arg(long)]
        no_display: bool,
        /// Disable input device passthrough
        #[arg(long)]
        no_input: bool,
    },
    /// Stop the Dillinger container
    Stop {
        /// Also remove the container after stopping
        #[arg(short, long)]
        remove: bool,
    },
    /// Restart the Dillinger container
    Restart,
    /// Show container status
    Status,
    /// Follow or print container logs
    Logs {
        /// Stream new log lines continuously
        #[arg(short, long)]
        follow: bool,
        /// Number of tail lines, or "all"
        #[arg(long, default_value = "100")]
        tail: String,
    },
    /// Check or apply image updates
    Update {
        #[command(subcommand)]
        sub: UpdateCommands,
    },
    /// Manage Docker volumes
    Volume {
        #[command(subcommand)]
        sub: VolumeCommands,
    },
    /// Show or set CLI configuration values
    Config {
        #[command(subcommand)]
        sub: ConfigCommands,
    },
    /// Run a system health check
    Doctor,
    /// Install Wolf udev rules
    Udev,
}

#[derive(Debug, Subcommand)]
enum UpdateCommands {
    /// Check if a newer image is available
    Check,
    /// Pull and apply the latest image
    Apply {
        /// Auto-confirm without prompting
        #[arg(short, long)]
        yes: bool,
    },
}

#[derive(Debug, Subcommand)]
enum VolumeCommands {
    /// List dillinger Docker volumes
    List,
    /// Create the core Docker volume (optionally as a bind mount)
    Create {
        /// Host path to bind-mount instead of creating a Docker volume
        #[arg(long)]
        bind: Option<String>,
    },
    /// Verify volume integrity
    Verify,
    /// Backup volume to a tar archive
    Backup {
        /// Output tar file path
        file: String,
    },
    /// Restore volume from a tar archive
    Restore {
        /// Input tar file path
        file: String,
    },
    /// Remove the core Docker volume (destructive)
    Destroy {
        /// Skip confirmation prompt
        #[arg(short, long)]
        force: bool,
    },
}

#[derive(Debug, Subcommand)]
enum ConfigCommands {
    /// Show current config values
    Show,
    /// Set a config key to a value
    Set { key: String, value: String },
    /// Reset config to defaults
    Reset,
}

// ── Main ──────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.yes {
        set_auto_yes(true);
    }

    let Some(command) = cli.command else {
        return tui::run().await;
    };

    match command {
        Commands::Start {
            port,
            no_detach,
            no_update_check,
            no_gpu,
            no_audio,
            no_display,
            no_input,
        } => {
            start_command(StartOptions {
                port,
                detach: !no_detach,
                no_update_check,
                gpu: !no_gpu,
                audio: !no_audio,
                display: !no_display,
                input: !no_input,
            })
            .await
        }
        Commands::Stop { remove } => stop_command(remove).await,
        Commands::Restart => restart_command().await,
        Commands::Status => status_command().await,
        Commands::Logs { follow, tail } => logs_command(follow, &tail).await,
        Commands::Update { sub } => match sub {
            UpdateCommands::Check => update_check_command().await,
            UpdateCommands::Apply { yes } => update_apply_command(yes).await,
        },
        Commands::Volume { sub } => match sub {
            VolumeCommands::List => volume_list_command().await,
            VolumeCommands::Create { bind } => volume_create_command(bind.as_deref()).await,
            VolumeCommands::Verify => volume_verify_command().await,
            VolumeCommands::Backup { file } => volume_backup_command(&file).await,
            VolumeCommands::Restore { file } => volume_restore_command(&file).await,
            VolumeCommands::Destroy { force } => volume_destroy_command(force).await,
        },
        Commands::Config { sub } => match sub {
            ConfigCommands::Show => config_show_command(),
            ConfigCommands::Set { key, value } => config_set_command(&key, &value),
            ConfigCommands::Reset => config_reset_command(),
        },
        Commands::Doctor => doctor_command().await,
        Commands::Udev => udev_command().await,
    }
}
