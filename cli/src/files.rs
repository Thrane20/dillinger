use std::{fs, path::PathBuf, path::Path};

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

pub fn file_exists(path: &Path) -> bool {
    path.exists() && path.is_file()
}

/// Write a file to disk
pub fn write_file(path: &PathBuf, contents: String, create_dir: bool) {

    if create_dir {
        // Create the directory if it doesn't exist
        fs::create_dir_all(&path.parent().unwrap()).expect("unable to create directory");
    }

    // Write the file
    fs::write(path, contents).expect("unable to write file");
}

pub fn read_file(path: &PathBuf) -> String {

    fs::read_to_string(path).unwrap_or_default()
//    match fs::read_to_string(path) {
//         Ok(file) => { 
//             file
//         },
//         Err(_) => {
//             "".to_string()
//         }
//     }
    
}

