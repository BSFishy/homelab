use crate::{
    args::BootstrapArgs,
    cloudflare::{Cloudflare, CloudflareTunnel},
    config::{CloudflareAccountConfig, CloudflareTunnelConfig, CloudflareWebsiteConfig, Config},
    token_cache::generate_token,
};
use dialoguer::{theme::ColorfulTheme, Input, Select};

const TUNNEL_NAME: &str = "homelab";

pub fn tunnel(args: &BootstrapArgs) -> CloudflareTunnel {
    let mut config = Config::open_or_default();

    fill_config(&mut config, args.input_credentials);

    let cloudflare = Cloudflare::new(
        config.cloudflare.user.api_token.clone().unwrap(),
        config.cloudflare.user.email.clone().unwrap(),
    );

    choose_account(&cloudflare, &mut config, args.choose_account);

    let account = config.cloudflare.account.clone().unwrap();

    choose_website(&cloudflare, &mut config, args.choose_website);

    println!("Using account {}", account.name);
    if let Some(website) = &config.cloudflare.website {
        println!("Using website {}", website.name);
    }

    let tunnels = cloudflare.list_tunnels(&account.id);
    for tunnel in tunnels {
        if tunnel.name != TUNNEL_NAME || tunnel.deleted {
            continue;
        }

        println!("Deleting existing tunnel {} ({})", tunnel.name, tunnel.id);
        cloudflare.delete_tunnel(&account.id, tunnel.id);
    }

    let tunnel_secret = generate_token();
    let tunnel = cloudflare.create_tunnel(&account.id, TUNNEL_NAME, &tunnel_secret);

    config.cloudflare.tunnel = Some(CloudflareTunnelConfig {
        secret: tunnel_secret,
        token: tunnel.token.clone(),
    });

    config.write();
    println!("Created tunnel: {} ({})", tunnel.name, tunnel.id);

    tunnel
}

fn fill_config(config: &mut Config, input_credentials: bool) {
    let mut dirty = false;
    let theme = ColorfulTheme::default();

    if config.cloudflare.user.api_token.is_none() || input_credentials {
        let mut input = Input::with_theme(&theme).with_prompt(
            "Cloudflare API Token\nCan be found at https://dash.cloudflare.com/profile/api-tokens\n",
        );

        if let Some(api_token) = &config.cloudflare.user.api_token {
            input = input.default(api_token.clone());
        }

        let api_token: String = input.interact_text().unwrap();
        config.cloudflare.user.api_token = Some(api_token);
        dirty = true;

        println!();
    }

    if config.cloudflare.user.email.is_none() || input_credentials {
        let mut input = Input::with_theme(&theme)
            .with_prompt("Cloudflare Email\nThe email associated with the API token provided\n");

        if let Some(email) = &config.cloudflare.user.email {
            input = input.default(email.clone());
        }

        let email: String = input.interact_text().unwrap();
        config.cloudflare.user.email = Some(email);
        dirty = true;

        println!();
    }

    if dirty {
        config.cloudflare.account = None;
        config.cloudflare.website = None;

        config.write();
    }
}

fn choose_account(cloudflare: &Cloudflare, config: &mut Config, choose_account: bool) {
    let mut dirty = false;
    let theme = ColorfulTheme::default();

    if config.cloudflare.account.is_none() || choose_account {
        let accounts = cloudflare.list_accounts();
        let account_strings: Vec<_> = accounts
            .iter()
            .map(|account| format!("{} ({})", account.name, account.id))
            .collect();

        let default_selection = if let Some(config_account) = &config.cloudflare.account {
            accounts
                .iter()
                .position(|account| account.id == config_account.id)
                .unwrap()
        } else {
            0
        };

        let selection = Select::with_theme(&theme)
            .with_prompt("Cloudflare Account")
            .default(default_selection)
            .items(&account_strings[..])
            .interact()
            .unwrap();

        let account = &accounts[selection];
        config.cloudflare.account = Some(CloudflareAccountConfig {
            id: account.id.clone(),
            name: account.name.clone(),
        });
        dirty = true;

        println!();
    }

    if dirty {
        config.cloudflare.website = None;

        config.write();
    }
}

fn choose_website(cloudflare: &Cloudflare, config: &mut Config, choose_website: bool) {
    let mut dirty = false;
    let theme = ColorfulTheme::default();

    if config.cloudflare.website.is_none() || choose_website {
        let websites = cloudflare.list_zones();
        let website_strings: Vec<_> = websites
            .iter()
            .map(|website| format!("{} ({})", website.name, website.id))
            .collect();

        let default_selection = if let Some(config_website) = &config.cloudflare.website {
            websites
                .iter()
                .position(|website| website.id == config_website.id)
                .unwrap()
        } else {
            0
        };

        let selection = Select::with_theme(&theme)
            .with_prompt("Cloudflare website")
            .default(default_selection)
            .items(&website_strings[..])
            .interact_opt()
            .unwrap();

        if let Some(selection) = selection {
            let account = &websites[selection];
            config.cloudflare.website = Some(CloudflareWebsiteConfig {
                id: account.id.clone(),
                name: account.name.clone(),
            });
        }

        dirty = true;

        println!();
    }

    if dirty {
        config.write();
    }
}
