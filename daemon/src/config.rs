use serde_json::Value;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;

pub struct ConfigMain {
    json_value: Value,
}

impl ConfigMain {

    pub fn version(&self) -> Result<String, Box<dyn std::error::Error>> {
        match self.get_json_value().get("version") {
            Some(value) => Ok(value.to_string()),
            None => Err("version attribute of main config missing or incorrect"),
        }

    }

    pub fn load_from_file(config_dir: &str) -> Self {

        match Self::load_json_from_file(&config_dir) {
            Ok(loaded_json) => {
               Self { json_value : loaded_json }
            }, 
            Err(err) => {
                // Error occurred while loading or parsing the JSON file
                eprintln!("Failed to load JSON file: {}", err);
                std::process::exit(1);
            }
        }
    }

    fn get_json_value(&self) -> &Value {
        &self.json_value
    }

    fn load_json_from_file(file_path: &str) -> Result<Value, Box<dyn std::error::Error>> {
        let mut path_to_file = PathBuf::new();
        path_to_file.push(file_path);
        path_to_file.push("config_main.json");
    
        let mut file = File::open(path_to_file)?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;
    
        let json_value: Value = serde_json::from_str(&contents)?;
        Ok(json_value)
    }
}


