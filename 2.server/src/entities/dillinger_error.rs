use std::fmt;
use log::error;

#[derive(Debug)]
pub struct DillingerError {
    pub description: String,
}

impl fmt::Display for DillingerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Description: {}",
            self.description
        )
    }
}

impl std::error::Error for DillingerError {}