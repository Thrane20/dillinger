use std::{fs, path::PathBuf};

use log::info;

pub fn get_cache_dir() -> PathBuf {
    let mut cache_dir = PathBuf::new();
    cache_dir.push("cache");
    cache_dir
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

pub fn read_file(path: &PathBuf) -> Option<String> {
    let file_str = match fs::read_to_string(path) {
        Ok(content) => Some(content),
        Err(e) => {
            eprintln!("Failed to read file: {}", e);
            None
        },
    };
    file_str
}

/// Write a file to disk
pub fn write_file(path: &PathBuf, contents: String, create_dir: bool) {

    if create_dir {
        // Create the directory if it doesn't exist
        fs::create_dir_all(&path.parent().unwrap()).expect("unable to create directory");
    }

    info!("Writing file to: {:?}", path);

    // Write the file
    fs::write(path, contents).expect("unable to write file");
}