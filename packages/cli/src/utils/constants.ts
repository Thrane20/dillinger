export const CLI_CONFIG_NAME = 'dillinger-gaming';

export const DEFAULTS = {
  port: 3010,
  imageName: 'ghcr.io/thrane20/dillinger/core',
  autoUpdate: true,
  volumeName: 'dillinger_root',
  containerName: 'dillinger',
} as const;

export const VERSIONING_URL =
  'https://raw.githubusercontent.com/Thrane20/dillinger/main/versioning.env';

export const UDEV_RULES_FILE = '/etc/udev/rules.d/85-wolf-virtual-inputs.rules';

export const WOLF_UDEV_RULES = `# Wolf Virtual Input Rules for Moonlight Game Streaming
KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input", OPTIONS+="static_node=uinput", TAG+="uaccess"
KERNEL=="uhid", GROUP="input", MODE="0660", TAG+="uaccess"
KERNEL=="hidraw*", ATTRS{name}=="Wolf PS5 (virtual) pad", GROUP="input", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf X-Box One (virtual) pad", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf PS5 (virtual) pad", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf gamepad (virtual) motion sensors", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf Nintendo (virtual) pad", MODE="0660", ENV{ID_SEAT}="seat9"
`;
