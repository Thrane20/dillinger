use serde::Serialize;
use std::{fs::File, path::Component};

#[derive(Clone, Serialize, Debug)]
pub struct DockerVolume {
    pub name: String,
}

impl DockerVolume {
    pub fn new() -> Self {
        DockerVolume {
            name: String::new(),
        }
    }
}

// Note: We're not modelling the volume contents as a tree structure, 
// but as a flat list of files and folders at a specific level in the tree. Simples.
#[derive(Clone, Serialize, Debug)]
pub struct VolumeContents {
    pub folders: Vec<String>,
    pub files: Vec<String>,
}

impl VolumeContents {
    pub fn new() -> Self {
        VolumeContents {
            folders: Vec::new(),
            files: Vec::new(),
        }
    }
}
