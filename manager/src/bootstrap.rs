use crate::{args::BootstrapArgs, config::Config, configure::configure, template::template};
use serde::{Deserialize, Serialize};
use std::fs::write;

fn find_compose_files() -> Vec<String> {
    glob::glob("**/compose.yml")
        .expect("Failed to read glob pattern")
        .map(|entry| entry.unwrap())
        .map(|path| format!("{}", path.display()))
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

    let mut config = Config::open_or_default();
    config.ports = port_mapping;
    config.tokens = token_mapping;
    config.write();

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

    configure();

    println!("Successfully configured the project");
}
