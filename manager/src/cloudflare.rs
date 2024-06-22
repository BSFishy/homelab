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

#[derive(Debug)]
pub struct CloudflareTunnelRoute {
    pub id: String,
    pub network: String,
    pub tunnel_id: String,
    pub deleted: bool,
}

#[derive(Debug, Clone)]
pub struct CloudflareVirtualNetwork {
    pub id: String,
    pub name: String,
    pub comment: Option<String>,
    pub default: bool,
    pub deleted: bool,
}

#[derive(Debug)]
pub struct CloudflareDomainFallback {
    pub description: Option<String>,
    pub dns_server: Vec<String>,
    pub suffix: String,
}

// Technically, its either address or host but I don't really care enough to do it correctly right
// now
#[derive(Debug)]
pub struct CloudflareInclude {
    pub address: Option<String>,
    pub description: Option<String>,
    pub host: Option<String>,
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

    pub fn list_tunnel_routes(&self, account_id: impl AsRef<str>) -> Vec<CloudflareTunnelRoute> {
        let response = self
            .client
            .get(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/teamnet/routes",
                account_id.as_ref()
            ))
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to list tunnel routes");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let routes: Vec<_> = body["result"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| CloudflareTunnelRoute {
                id: entry["id"].as_str().unwrap().to_string(),
                network: entry["network"].as_str().unwrap().to_string(),
                tunnel_id: entry["tunnel_id"].as_str().unwrap().to_string(),
                deleted: !entry["deleted_at"].is_null(),
            })
            .collect();

        routes
    }

    pub fn create_tunnel_route(
        &self,
        account_id: impl AsRef<str>,
        tunnel_id: impl AsRef<str>,
        virtual_network_id: impl AsRef<str>,
        network: impl AsRef<str>,
        comment: Option<String>,
    ) {
        let body = serde_json::json!({
            "comment": comment,
            "network": network.as_ref(),
            "tunnel_id": tunnel_id.as_ref(),
            "virtual_network_id": virtual_network_id.as_ref(),
        });
        let body = serde_json::to_string(&body).unwrap();

        let response = self
            .client
            .post(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/teamnet/routes",
                account_id.as_ref()
            ))
            .header(header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to create tunnel route for {}", network.as_ref());
        }
    }

    pub fn delete_tunnel_route(&self, account_id: impl AsRef<str>, route_id: impl AsRef<str>) {
        let response = self
            .client
            .delete(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/teamnet/routes/{}",
                account_id.as_ref(),
                route_id.as_ref()
            ))
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to delete tunnel {}", route_id.as_ref());
        }
    }

    pub fn list_virtual_networks(
        &self,
        account_id: impl AsRef<str>,
    ) -> Vec<CloudflareVirtualNetwork> {
        let response = self
            .client
            .get(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/teamnet/virtual_networks",
                account_id.as_ref()
            ))
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to list virtual networks");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let networks: Vec<_> = body["result"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| CloudflareVirtualNetwork {
                id: entry["id"].as_str().unwrap().to_string(),
                name: entry["name"].as_str().unwrap().to_string(),
                comment: entry["comment"].as_str().map(str::to_string),
                default: entry["is_default_network"].as_bool().unwrap(),
                deleted: !entry["deleted_at"].is_null(),
            })
            .collect();

        networks
    }

    pub fn create_virtual_network(
        &self,
        account_id: impl AsRef<str>,
        name: impl AsRef<str>,
        comment: Option<String>,
        default: bool,
    ) -> CloudflareVirtualNetwork {
        let body = serde_json::json!({
            "comment": comment,
            "is_default": default,
            "name": name.as_ref(),
        });
        let body = serde_json::to_string(&body).unwrap();

        let response = self
            .client
            .post(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/teamnet/virtual_networks",
                account_id.as_ref()
            ))
            .header(header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to create virtual network {}", name.as_ref());
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();

        CloudflareVirtualNetwork {
            id: body["result"]["id"].as_str().unwrap().to_string(),
            name: body["result"]["name"].as_str().unwrap().to_string(),
            comment: body["result"]["comment"].as_str().map(str::to_string),
            default: body["result"]["is_default_network"].as_bool().unwrap(),
            deleted: false,
        }
    }

    pub fn enable_gateway_proxy(&self, account_id: impl AsRef<str>) {
        let body = serde_json::json!({
            "gateway_proxy_enabled": true,
            "gateway_udp_proxy_enabled": true,
        });
        let body = serde_json::to_string(&body).unwrap();

        let response = self
            .client
            .put(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/devices/settings",
                account_id.as_ref()
            ))
            .header(header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to enable gateway proxy");
        }
    }

    pub fn list_fallback_domains(
        &self,
        account_id: impl AsRef<str>,
    ) -> Vec<CloudflareDomainFallback> {
        let response = self
            .client
            .get(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/devices/policy/fallback_domains",
                account_id.as_ref()
            ))
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to list fallback domains");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let domains: Vec<_> = body["result"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| CloudflareDomainFallback {
                description: entry["description"].as_str().map(str::to_string),
                dns_server: entry["dns_server"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .map(|url| url.as_str().unwrap().to_string())
                    .collect(),
                suffix: entry["suffix"].as_str().unwrap().to_string(),
            })
            .collect();

        domains
    }

    pub fn set_fallback_domains(
        &self,
        account_id: impl AsRef<str>,
        domains: Vec<CloudflareDomainFallback>,
    ) {
        let domains: Vec<_> = domains
            .iter()
            .map(|domain| {
                serde_json::json!({
                    "description": domain.description,
                    "dns_server": domain.dns_server,
                    "suffix": domain.suffix,
                })
            })
            .collect();
        let body = serde_json::to_string(&domains).unwrap();

        let response = self
            .client
            .put(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/devices/policy/fallback_domains",
                account_id.as_ref()
            ))
            .header(header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to set backup domains");
        }
    }

    pub fn list_split_tunnel_includes(
        &self,
        account_id: impl AsRef<str>,
    ) -> Vec<CloudflareInclude> {
        let response = self
            .client
            .get(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/devices/policy/include",
                account_id.as_ref()
            ))
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to list split tunnel includes");
        }

        let body = response.text().unwrap();
        let body: serde_json::Value = serde_json::from_str(&body).unwrap();
        let includes: Vec<_> = body["result"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|entry| CloudflareInclude {
                address: entry["address"].as_str().map(str::to_string),
                description: entry["description"].as_str().map(str::to_string),
                host: entry["host"].as_str().map(str::to_string),
            })
            .collect();

        includes
    }

    pub fn set_split_tunnel_includes(
        &self,
        account_id: impl AsRef<str>,
        includes: Vec<CloudflareInclude>,
    ) {
        let includes: Vec<_> = includes
            .iter()
            .map(|include| {
                serde_json::json!({
                    "address": include.address,
                    "description": include.description,
                    "host": include.host,
                })
            })
            .collect();
        let body = serde_json::to_string(&includes).unwrap();

        let response = self
            .client
            .put(format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/devices/policy/include",
                account_id.as_ref()
            ))
            .header(header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .unwrap();

        if !response.status().is_success() {
            panic!("Failed to set split tunnel includes");
        }
    }
}
