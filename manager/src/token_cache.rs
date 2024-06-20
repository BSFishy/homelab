use base64::{engine::general_purpose::STANDARD, Engine};
use rand::{thread_rng, Rng};
use std::collections::HashMap;

use crate::{args::BootstrapArgs, tunnel::tunnel};

// Size in bytes that the generated token should be. Cloudflare requires at least a 32 byte token,
// and we double that.
const TOKEN_LENGTH: usize = 64;

pub fn generate_token() -> String {
    let mut buf = [0 as char; TOKEN_LENGTH];
    thread_rng().fill(&mut buf[..]);

    let token: String = buf.into_iter().collect();

    STANDARD.encode(token)
}

#[derive(Debug)]
pub struct TokenCache {
    args: BootstrapArgs,
    mapping: HashMap<String, String>,
}

impl TokenCache {
    pub fn new(args: &BootstrapArgs) -> TokenCache {
        TokenCache {
            args: args.clone(),
            mapping: HashMap::default(),
        }
    }

    pub fn get<S: AsRef<str>>(&mut self, name: S) -> String {
        let name = name.as_ref().to_string();
        if name == "cloudflared" {
            let tunnel = tunnel(&self.args);

            return tunnel.token;
        }

        panic!("unknown token type: {}", name);
    }

    pub fn mapping(&self) -> &HashMap<String, String> {
        &self.mapping
    }
}
