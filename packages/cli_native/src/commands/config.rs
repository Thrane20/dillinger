use anyhow::Result;

use crate::utils::{
    config::{config_keys, config_path, get_config, reset_config, set_config_value},
    ui::LOG,
};

pub fn config_show_command() -> Result<()> {
    let config = get_config();
    LOG.info(&format!("Config file: {}", config_path().display()));
    LOG.plain(&serde_json::to_string_pretty(&config)?);
    Ok(())
}

pub fn config_set_command(key: &str, value: &str) -> Result<()> {
    let valid_keys = config_keys();
    if !valid_keys.contains(&key) {
        LOG.error(&format!("Unknown config key: {}", key));
        std::process::exit(1);
    }
    set_config_value(key, value)?;
    LOG.success(&format!("Updated {}", key));
    Ok(())
}

pub fn config_reset_command() -> Result<()> {
    reset_config()?;
    LOG.success("Config reset to defaults");
    Ok(())
}
