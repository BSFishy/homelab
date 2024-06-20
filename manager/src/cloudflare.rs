use reqwest::{
    blocking::Client,
    header::{self, HeaderMap, HeaderValue},
};

#[derive(Debug)]
pub struct Cloudflare {
    client: Client,
}

#[derive(Debug)]
pub struct CloudflareAccount {
    pub id: String,
    pub name: String,
}

#[derive(Debug)]
pub struct CloudflareZone {
    pub id: String,
    pub name: String,
}

#[derive(Debug)]
pub struct CloudflareTunnelList {
    pub id: String,
    pub name: String,
    pub deleted: bool,
}

#[derive(Debug)]
pub struct CloudflareTunnel {
    pub id: String,
    pub name: String,
    pub token: String,
}

impl Cloudflare {
    pub fn new(api_token: impl AsRef<str>, email: impl AsRef<str>) -> Cloudflare {
        let mut headers = HeaderMap::new();
        headers.insert(
            "X-Auth-Key",
            HeaderValue::from_str(api_token.as_ref()).unwrap(),
        );
        headers.insert(
            "X-Auth-Email",
            HeaderValue::from_str(email.as_ref()).unwrap(),
        );

        let client = Client::builder().default_headers(headers).build().unwrap();

        Cloudflare { client }
    }

    pub fn list_accounts(&self) -> Vec<CloudflareAccount> {
        let response = self
            .client
            .get("https://api.cloudflare.com/client/v4/accounts")
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Unable to list accounts");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let accounts: Vec<_> = body["result"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| CloudflareAccount {
                id: entry["id"].as_str().unwrap().to_string(),
                name: entry["name"].as_str().unwrap().to_string(),
            })
            .collect();

        accounts
    }

    pub fn list_zones(&self) -> Vec<CloudflareZone> {
        let response = self
            .client
            .get("https://api.cloudflare.com/client/v4/zones")
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to list zones");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let zones: Vec<_> = body["result"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| CloudflareZone {
                id: entry["id"].as_str().unwrap().to_string(),
                name: entry["name"].as_str().unwrap().to_string(),
            })
            .collect();

        zones
    }

    pub fn list_tunnels(&self, account_id: impl AsRef<str>) -> Vec<CloudflareTunnelList> {
        let response = self
            .client
            .get(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/cfd_tunnel",
                account_id.as_ref()
            ))
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Unable to list tunnels");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let tunnels: Vec<_> = body["result"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| CloudflareTunnelList {
                id: entry["id"].as_str().unwrap().to_string(),
                name: entry["name"].as_str().unwrap().to_string(),
                deleted: !entry["deleted_at"].is_null(),
            })
            .collect();

        tunnels
    }

    pub fn create_tunnel(
        &self,
        account_id: impl AsRef<str>,
        name: impl AsRef<str>,
        tunnel_secret: impl AsRef<str>,
    ) -> CloudflareTunnel {
        let body = serde_json::json!({
            "config_src": "cloudflare",
            "name": name.as_ref(),
            "tunnel_secret": tunnel_secret.as_ref(),
        });
        let body = serde_json::to_string(&body).unwrap();

        let response = self
            .client
            .post(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/cfd_tunnel",
                account_id.as_ref()
            ))
            .header(header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to create tunnel");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let tunnel_id = body["result"]["id"].as_str().unwrap().to_string();
        let tunnel_name = body["result"]["name"].as_str().unwrap().to_string();
        let tunnel_token = body["result"]["token"].as_str().unwrap().to_string();

        CloudflareTunnel {
            id: tunnel_id,
            name: tunnel_name,
            token: tunnel_token,
        }
    }

    pub fn delete_tunnel(&self, account_id: impl AsRef<str>, tunnel_id: impl AsRef<str>) {
        let response = self
            .client
            .delete(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/cfd_tunnel/{}",
                account_id.as_ref(),
                tunnel_id.as_ref()
            ))
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to delete tunnel. Make sure cloudflared is stopped everywhere and connections are closed.");
        }
    }
}