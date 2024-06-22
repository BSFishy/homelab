use std::{
    fs::{read_to_string, write},
    path::PathBuf,
};

#[derive(Debug)]
pub struct Domain {
    pub ip: String,
    pub host: String,
}

pub fn read_list(path: &PathBuf) -> Vec<Domain> {
    if !path.exists() {
        return vec![];
    }

    let contents = read_to_string(path).unwrap();
    let entries: Vec<Domain> = contents
        .split('\n')
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.split(' ').collect::<Vec<_>>())
        .map(|entry| Domain {
            ip: entry[0].to_string(),
            host: entry[1].to_string(),
        })
        .collect();

    entries
}

pub fn write_list(path: &PathBuf, domains: Vec<Domain>) {
    let domains: Vec<_> = domains
        .iter()
        .map(|domain| format!("{} {}", domain.ip, domain.host))
        .collect();
    let domains = domains.join("\n");

    write(path, domains).unwrap();
}
