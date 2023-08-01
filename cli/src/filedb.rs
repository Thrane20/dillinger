use std::path::PathBuf;
use crate::files;
use crate::global_types::DillingerConfig;

/// This code file manages all the file based operations for Dillinger
/// That's correct, no database, just files. Human readability ftw.
/// 
struct ManifestManager {
    pub dillinger_config: DillingerConfig
}

impl ManifestManager {

    fn get_games_path(&self) -> PathBuf {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("games");
        path
    }

    pub fn new(dillinger_config: DillingerConfig) -> ManifestManager {
        ManifestManager {
            dillinger_config: dillinger_config
        }
    }

    pub fn get_mcp_file(&self) -> String {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push("mcp.json");
        path.to_str().unwrap().to_string()
    }

    pub fn get_manifest_file(&self, filename: String) -> String {
        let mut path = PathBuf::from(&self.dillinger_config.paths.data_dir);
        path.push(filename);
        path.to_str().unwrap().to_string()
    }

}
