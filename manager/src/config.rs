use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env::current_dir,
    fs::{read_to_string, write},
    path::PathBuf,
};

fn file_name() -> PathBuf {
    current_dir().unwrap().join("homelab.json")
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct Config {
    pub ports: HashMap<String, u16>,
    pub tokens: HashMap<String, String>,
    pub cloudflare: CloudflareConfig,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct CloudflareConfig {
    pub account: Option<CloudflareAccountConfig>,
    pub user: CloudflareUserConfig,
    pub tunnel: Option<CloudflareTunnelConfig>,
    pub website: Option<CloudflareWebsiteConfig>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct CloudflareAccountConfig {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct CloudflareUserConfig {
    pub email: Option<String>,
    pub api_token: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct CloudflareTunnelConfig {
    pub token: String,
    pub secret: String,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct CloudflareWebsiteConfig {
    pub id: String,
    pub name: String,
}

impl Config {
    pub fn open() -> Option<Config> {
        let file_name = file_name();
        if !file_name.exists() {
            return None;
        }

        let file_contents = read_to_string(file_name).unwrap();

        serde_json::from_str(&file_contents).unwrap()
    }

    pub fn open_or_default() -> Config {
        Config::open().unwrap_or_default()
    }

    pub fn write(&self) {
        let file_name = file_name();
        let file_contents = serde_json::to_string(self).unwrap();

        write(file_name, file_contents).unwrap();
    }
}
