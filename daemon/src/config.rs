use serde_json::{ Value };
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;

pub struct ConfigMain {
    json_value: Value,
}

impl ConfigMain {
    pub fn version(&self) -> Result<f32, Box<dyn std::error::Error>> {
        match self.get_json_value().get("version") {
            Some(value) => {
                let version = match value.as_str().unwrap().to_string().parse::<f32>() {
                    Ok(v) => v,
                    Err(_) => {
                        return Err(
                            "The version number of the main config file is not a valid float".into()
                        );
                    }
                };
                Ok(version)
            }
            None => { Err("version attribute in main config missing or incorrect".into()) }
        }
    }

    pub fn data_dir(&self) -> Result<String, Box<dyn std::error::Error>> {
        match self.get_json_value().get("data_dir") {
            Some(value) => value.as_str().map(|s| s.to_string()).ok_or(
                "data_dir attribute in main config missing or incorrect".into()
            ),
            None => { Err("data_dir attribute in main config missing or incorrect".into()) }
        }
    }

    pub fn load_from_file(config_dir: &str) -> Self {
        match Self::load_json_from_file(&config_dir) {
            Ok(loaded_json) => { Self { json_value: loaded_json } }
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

    pub fn validate_config(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut is_valid;
        let mut error_message = String::new();

        // Validate version - it should be a number
        is_valid = match self.version() {
            Ok(_) => true,
            Err(msg) => {
                error_message = msg.to_string();
                false
            }
        };

        // There should be a data_dir directory
        is_valid = is_valid && match self.data_dir() {
            Ok(_) => true,
            Err(msg) => {
                error_message = msg.to_string();
                false
            }
        };

        match is_valid {
            true => Ok(()),
            false => {
                let error_string = format!("Config file is not valid: {}", error_message);
                Err(error_string.into())
            }
        }
    }
}
