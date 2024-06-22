use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Service {
    pub name: String,
    pub domain: Option<String>,
    pub ports: Vec<u16>,
}
