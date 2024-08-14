
const PLATFORM_SLUGS: [&str; 2] = ["arcade", "c64"];


#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Platform {
    pub slug: String,
    pub name: String,
    pub description: String,
}

impl Default for Platform {
    fn default() -> Self {
        Self {
            slug: String::new(),
            name: String::new(),
            description: String::new()
        }
    }
}