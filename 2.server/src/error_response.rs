use std::fmt::Error;

use serde::Serialize;
use crate::docker::docker_interactor::DockerError;

#[derive(Serialize, Debug)]
pub struct ErrorResponse {
    message: String,
}

impl ErrorResponse {
    // Simple constructor
    pub fn new(message: String) -> Self {
        ErrorResponse { message }
    }
}


impl From<DockerError> for ErrorResponse {
    fn from(error: DockerError) -> Self {
        ErrorResponse {
            message: error.message,
        }
    }
}