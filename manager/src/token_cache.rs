use base64::{engine::general_purpose::STANDARD, Engine};
use rand::{thread_rng, Rng};
use std::collections::HashMap;

// Size in bytes that the generated token should be. Cloudflare requires at least a 32 byte token,
// and we double that.
const TOKEN_LENGTH: usize = 64;

fn generate_token() -> String {
    let mut buf = [0 as char; TOKEN_LENGTH];
    thread_rng().fill(&mut buf[..]);

    let token: String = buf.into_iter().collect();

    STANDARD.encode(token)
}

#[derive(Debug, Default)]
pub struct TokenCache {
    mapping: HashMap<String, String>,
}

impl TokenCache {
    pub fn get<S: AsRef<str>>(&mut self, name: S) -> String {
        let name = name.as_ref().to_string();
        if let Some(token) = self.mapping.get(&name) {
            return token.clone();
        }

        let token = generate_token();
        self.mapping.insert(name, token.clone());

        token
    }

    pub fn mapping(&self) -> &HashMap<String, String> {
        &self.mapping
    }
}
