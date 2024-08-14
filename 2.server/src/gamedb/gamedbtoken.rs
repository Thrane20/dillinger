use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameDbToken {
    pub db: String,
    pub access_token: Option<String>,
    pub id_token: Option<String>,
    pub expires_in: Option<u64>,
}

impl GameDbToken {
    pub fn new(db: String) -> Self {
        GameDbToken {
            db,
            access_token: None,
            id_token: None,
            expires_in: None,
        }
    }
}
