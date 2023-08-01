use crate::global_types::Game;

pub struct AuthToken {
    pub db: String,
    pub access_token: String,
    pub expires_in: u64,
    pub token_type: String,
}

impl AuthToken {
    
    pub(crate) fn clone(&self) -> AuthToken {
        AuthToken {
            db: self.db.clone(),
            access_token: self.access_token.clone(),
            expires_in: self.expires_in,
            token_type: self.token_type.clone(),
        }
    }

    pub(crate) fn new() -> AuthToken {
        AuthToken {
            db: "".to_string(),
            access_token: "".to_string(),
            expires_in: 0,
            token_type: "".to_string(),
        }
    }
}


pub trait GameDatabase {
    fn authentiate(&mut self) -> Result<AuthToken, reqwest::Error>;
    fn search_game(&mut self, name: &str) -> Vec<Game>;
    fn get_game_data(&mut self, id: u64, name: String) -> Game;
}


