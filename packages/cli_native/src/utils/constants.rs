/// Default web UI host port.
pub const DEFAULT_PORT: u16 = 3010;

/// Default Docker image name.
pub const DEFAULT_IMAGE_NAME: &str = "ghcr.io/thrane20/dillinger/core";

/// Default auto-update behaviour.
pub const DEFAULT_AUTO_UPDATE: bool = true;

/// Default Docker volume name for core data.
pub const DEFAULT_VOLUME_NAME: &str = "dillinger_core";

/// Default Docker container name.
pub const DEFAULT_CONTAINER_NAME: &str = "dillinger";

/// CLI config project name (used for XDG directories).
pub const CLI_CONFIG_NAME: &str = "dillinger-gaming";

/// Remote versioning.env URL.
pub const VERSIONING_URL: &str =
    "https://raw.githubusercontent.com/Thrane20/dillinger/main/versioning.env";

/// Path to the Wolf udev rules file.
pub const UDEV_RULES_FILE: &str = "/etc/udev/rules.d/85-wolf-virtual-inputs.rules";

/// Content of the Wolf udev rules.
pub const WOLF_UDEV_RULES: &str = "\
# Wolf Virtual Input Rules for Moonlight Game Streaming\n\
KERNEL==\"uinput\", SUBSYSTEM==\"misc\", MODE=\"0660\", GROUP=\"input\", OPTIONS+=\"static_node=uinput\", TAG+=\"uaccess\"\n\
KERNEL==\"uhid\", GROUP=\"input\", MODE=\"0660\", TAG+=\"uaccess\"\n\
KERNEL==\"hidraw*\", ATTRS{name}==\"Wolf PS5 (virtual) pad\", GROUP=\"input\", MODE=\"0660\", ENV{ID_SEAT}=\"seat9\"\n\
SUBSYSTEMS==\"input\", ATTRS{name}==\"Wolf X-Box One (virtual) pad\", MODE=\"0660\", ENV{ID_SEAT}=\"seat9\"\n\
SUBSYSTEMS==\"input\", ATTRS{name}==\"Wolf PS5 (virtual) pad\", MODE=\"0660\", ENV{ID_SEAT}=\"seat9\"\n\
SUBSYSTEMS==\"input\", ATTRS{name}==\"Wolf gamepad (virtual) motion sensors\", MODE=\"0660\", ENV{ID_SEAT}=\"seat9\"\n\
SUBSYSTEMS==\"input\", ATTRS{name}==\"Wolf Nintendo (virtual) pad\", MODE=\"0660\", ENV{ID_SEAT}=\"seat9\"\n\
";

/// Volume name prefix for Wine install roots.
pub const INSTALLED_VOLUME_PREFIX: &str = "dillinger_installed_";

/// Standard volumes that are always mounted.
pub const STANDARD_VOLUMES: &[(&str, &str)] = &[
    ("dillinger_roms", "/roms"),
    ("dillinger_cache", "/cache"),
];

/// Root path inside runner containers where extra managed volumes are mounted.
pub const EXTRA_RUNNER_VOLUME_ROOT: &str = "/mnt/dillinger-volumes";
