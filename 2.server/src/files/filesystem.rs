use log::debug;
use serde::Serialize;
use std::{
    fs::{self},
    path::PathBuf,
};

use crate::error_response::ErrorResponse;

// Note: We're not modelling the full contents as a tree structure,
// but as a flat list of files and folders at a specific level in the tree. Simples.
#[derive(Clone, Serialize, Debug)]
pub struct DirectoryContents {
    pub folders: Vec<String>,
    pub files: Vec<String>,
}

impl DirectoryContents {
    pub fn new() -> Self {
        DirectoryContents {
            folders: Vec::new(),
            files: Vec::new(),
        }
    }
}

pub async fn get_directory_contents(path: String) -> Result<(DirectoryContents), ErrorResponse> {
    debug!("Getting directory contents for path: {}", path);
    let mut contents = get_files_in_dir(&PathBuf::from(path));
    let mut dir_contents = DirectoryContents::new();
    for content in contents {
        if content.is_dir() {
            dir_contents
                .folders
                .push(content.file_name().unwrap().to_string_lossy().to_string());
        } else {
            dir_contents
                .files
                .push(content.file_name().unwrap().to_string_lossy().to_string());
        }
    }

    Ok(dir_contents)
}

/// This finds all files and folders in a directory
pub fn get_files_in_dir(dir_path: &PathBuf) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = Vec::new();
    match fs::read_dir(dir_path) {
        Ok(entries) => {
            debug!("Reading directory: {:?}", dir_path);
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    files.push(path);
                }
            }
        }
        Err(e) => {
            debug!("Failed to read directory: {}", e);
            // Handle the error as needed, e.g., return an empty vector or propagate the error
        }
    }
    files
}

pub fn get_dirs_in_dir(dir_path: &PathBuf) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    dirs.push(path);
                }
            }
        }
    }
    dirs
}
