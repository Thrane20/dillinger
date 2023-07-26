use chrono::{ Utc };
use serde::Serialize;

#[derive(Serialize,serde::Deserialize)]
pub struct Game {
    pub name: String,
    pub description: String,
    pub last_played: String,
    pub times_played: u32,
}

impl Game {
    pub fn new(name: String, description: String) -> Self {
        Self {
            name,
            description,
            last_played: Utc::now().to_rfc2822(),
            times_played: 0,
        }
    }

    pub fn set_played(&mut self) {
        self.last_played = Utc::now().to_rfc2822();
        self.times_played += 1;
    }
}
