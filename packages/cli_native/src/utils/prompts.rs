use std::sync::atomic::{AtomicBool, Ordering};

static AUTO_YES: AtomicBool = AtomicBool::new(false);

pub fn set_auto_yes(value: bool) {
    AUTO_YES.store(value, Ordering::Relaxed);
}

pub fn is_auto_yes() -> bool {
    AUTO_YES.load(Ordering::Relaxed)
}

/// Asks the user for a yes/no confirmation. Returns `true` immediately when
/// auto-yes mode is active.
pub fn confirm(message: &str, default: bool) -> anyhow::Result<bool> {
    if is_auto_yes() {
        return Ok(true);
    }
    let result = dialoguer::Confirm::new()
        .with_prompt(message)
        .default(default)
        .interact()?;
    Ok(result)
}

/// Presents a selection list to the user.
#[allow(dead_code)]
pub fn select<T: Clone>(
    message: &str,
    choices: &[(String, T)],
) -> anyhow::Result<T> {
    let labels: Vec<&str> = choices.iter().map(|(l, _)| l.as_str()).collect();
    let idx = dialoguer::Select::new()
        .with_prompt(message)
        .items(&labels)
        .default(0)
        .interact()?;
    Ok(choices[idx].1.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auto_yes_returns_true_immediately() {
        set_auto_yes(true);
        assert!(confirm("continue?", true).unwrap());
        // Reset so other tests are not affected.
        set_auto_yes(false);
    }
}
