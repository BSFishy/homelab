use crate::{
    args::BootstrapArgs,
    config::Config,
    configure::configure,
    nginx::generate_conf,
    pihole::{read_list, write_list},
    service::Service,
    template::template,
};
use local_ip_address::linux::local_ip;
use serde::{Deserialize, Serialize};
use std::{
    fs::{read_to_string, write},
    path::PathBuf,
};

const PIHOLE_SERVICE_NAME: &str = "pihole";
const PIHOLE_LIST_PATH: &str = "etc-pihole/custom.list";
const NGINX_SERVICE_NAME: &str = "nginx";
const NGINX_CONF_PATH: &str = "config";
const WEB_PORT_TYPE: &str = "web";

fn find_compose_files() -> Vec<String> {
    glob::glob("**/compose.yml")
        .expect("Failed to read glob pattern")
        .map(|entry| entry.unwrap())
        .map(|path| format!("{}", path.display()))
        .collect()
}

fn find_service_files() -> Vec<(PathBuf, Service)> {
    glob::glob("**/service.json")
        .expect("Failed to read glob pattern")
        .map(|entry| entry.unwrap())
        .map(|path| (path.clone(), read_to_string(path).unwrap()))
        .map(|(path, contents)| (path, serde_json::from_str::<Service>(&contents).unwrap()))
        .filter(|(_, service)| service.enabled)
        .collect()
}

#[derive(Serialize, Deserialize, Debug)]
struct DockerCompose {
    name: String,
    include: Vec<String>,
}

pub fn bootstrap(args: BootstrapArgs) {
    let current_dir = std::env::current_dir().unwrap();

    let (port_mapping, token_mapping) = template(&args, &current_dir);

    {
        let mut config = Config::open_or_default();
        config.ports = port_mapping;
        config.tokens = token_mapping;
        config.write();
    }

    {
        // TODO: filter out compose files for disabled services
        let compose_files = find_compose_files();
        let compose = DockerCompose {
            name: "homelab".to_string(),
            include: compose_files,
        };

        let file_contents = serde_yaml::to_string(&compose).unwrap();
        let file_name = current_dir.join("docker-compose.yml");
        write(&file_name, file_contents).unwrap();

        println!(
            "Wrote {}",
            file_name.strip_prefix(&current_dir).unwrap().display()
        );
    }

    println!("Finished templating");

    let services = find_service_files();

    {
        if let Some((path, _service)) = services
            .iter()
            .find(|(_, service)| service.name == PIHOLE_SERVICE_NAME)
        {
            let local_ip = local_ip().unwrap();
            let local_ip = format!("{}", local_ip);

            let list_path = path.parent().unwrap().join(PIHOLE_LIST_PATH);
            let mut domains = read_list(&list_path);

            for (_, service) in &services {
                if let Some(service_domain) = &service.domain {
                    if let Some(domain) = domains
                        .iter_mut()
                        .find(|domain| &domain.host == service_domain)
                    {
                        domain.ip.clone_from(&local_ip);
                        println!("Updated the IP for {}", service_domain);
                    } else {
                        domains.push(crate::pihole::Domain {
                            ip: local_ip.clone(),
                            host: service_domain.clone(),
                        });

                        println!("Created new DNS record for {}", service_domain);
                    }
                }
            }

            write_list(&list_path, domains);

            println!("Updated DNS list");
        }
    }

    {
        if let Some((path, _service)) = services
            .iter()
            .find(|(_, service)| service.name == NGINX_SERVICE_NAME)
        {
            let local_ip = local_ip().unwrap();
            let local_ip = format!("{}", local_ip);

            let config_path = path.parent().unwrap().join(NGINX_CONF_PATH);

            for (_, service) in &services {
                let domain_name = match &service.domain {
                    Some(domain_name) => domain_name,
                    None => continue,
                };

                let port = match service
                    .ports
                    .iter()
                    .find(|port| port.port_type == WEB_PORT_TYPE)
                {
                    Some(port) => port.value.parse::<u16>().unwrap(),
                    None => continue,
                };

                let service_path = config_path.join(format!("{}.conf", service.name));
                let config_contents = generate_conf(&local_ip, domain_name, port);

                write(&service_path, config_contents).unwrap();

                println!("Wrote nginx config file {}", service_path.display());
            }
        }
    }

    let services: Vec<_> = services
        .iter()
        .map(|(_, service)| service.clone())
        .collect();
    configure(&services);

    println!("Successfully configured the project");
}
