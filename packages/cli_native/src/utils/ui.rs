use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use std::time::Duration;

pub struct Logger;

impl Logger {
    pub fn info(&self, message: &str) {
        println!("{}", format!("ℹ {}", message).cyan());
    }

    pub fn success(&self, message: &str) {
        println!("{}", format!("✓ {}", message).green());
    }

    pub fn warn(&self, message: &str) {
        println!("{}", format!("⚠ {}", message).yellow());
    }

    pub fn error(&self, message: &str) {
        eprintln!("{}", format!("✗ {}", message).red());
    }

    pub fn plain(&self, message: &str) {
        println!("{}", message);
    }
}

pub static LOG: Logger = Logger;

pub fn create_spinner(text: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::with_template("{spinner:.blue} {msg}")
            .unwrap()
            .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
    );
    pb.set_message(text.to_string());
    pb.enable_steady_tick(Duration::from_millis(100));
    pb
}
