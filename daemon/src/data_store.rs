use serde::{Serialize,Deserialize};
use chrono::{ DateTime, Utc };
use jfs::Store;
use std::path::PathBuf;
use crate::game::Game;


#[derive(Serialize,Deserialize)]
pub struct DataStore {
    db_name: String
}

impl DataStore {

    pub fn new(db_name: String) -> Self {
        Self {
            db_name,
        }
    }

    pub fn test_save_db(&self, directory: String) -> Result<(), Box<dyn std::error::Error>> {
        
        let mut path_to_file = PathBuf::new();
        path_to_file.push(directory);
        path_to_file.push("last_played.json");


        let db = Store::new(path_to_file).unwrap();
        let game = Game { name: "test".to_string(), description: "test".to_string(), last_played: Utc::now().to_rfc2822(), times_played: 0 };
        let id = db.save(&game).unwrap();
        let obj = db.get::<Game>(&id).unwrap();

        // return an empty result
        Ok(())
    }
    
}

