
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Platform {
    pub name: String,
    pub description: String,
}

impl Default for Platform {
    fn default() -> Self {
        Self {
            name: String::new(),
            description: String::new()
        }
    }
}