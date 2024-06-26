use crate::{args::BootstrapArgs, port_cache::PortCache, token_cache::TokenCache};
use ignore::Walk;
use regex::{Captures, Regex, Replacer};
use std::{
    collections::HashMap,
    fs::{read_to_string, write},
    path::{Path, PathBuf},
};
use users::{get_current_gid, get_current_uid};

pub fn template(
    args: &BootstrapArgs,
    dir: &PathBuf,
) -> (HashMap<String, u16>, HashMap<String, String>) {
    let re = Regex::new(r"\$\{([^}:]+)(?:\:([^}]+))?\}").unwrap();
    let mut replacer = EnvReplacer {
        port_cache: PortCache::default(),
        token_cache: TokenCache::new(args),
    };

    for result in Walk::new(dir) {
        let entry = result.unwrap();
        let path = entry.path();
        if path.is_dir() {
            continue;
        }

        if contains_in_dot(path) {
            let file_contents = read_to_string(path).unwrap();
            let file_contents = re.replace_all(&file_contents, &mut replacer);

            if let Some(new_path) = strip_in_extension(path) {
                write(&new_path, file_contents.as_ref()).unwrap();

                println!("Wrote {}", new_path.strip_prefix(dir).unwrap().display());
            } else {
                eprintln!("Failed to write {}", path.display());
            }
        }
    }

    let port_mapping = replacer.port_cache.mapping().clone();
    let token_mapping = replacer.token_cache.mapping().clone();

    (port_mapping, token_mapping)
}

struct EnvReplacer {
    port_cache: PortCache,
    token_cache: TokenCache,
}

impl Replacer for &mut EnvReplacer {
    fn replace_append(&mut self, caps: &Captures<'_>, dst: &mut String) {
        let var = &caps[1];
        if var == "PORT" {
            let service_name = &caps[2];
            let port = self.port_cache.get(service_name);

            dst.push_str(&format!("{}", port));
            return;
        }

        if var == "TOKEN" {
            let token_name = &caps[2];
            let token = self.token_cache.get(token_name);

            dst.push_str(&token);
            return;
        }

        let value = std::env::var(var);
        let value = value.unwrap_or_else(|_| {
            if var == "UID" {
                format!("{}", get_current_uid())
            } else if var == "GID" {
                format!("{}", get_current_gid())
            } else {
                caps.get(2)
                    .expect("default value not found")
                    .as_str()
                    .to_string()
            }
        });

        dst.push_str(&value);
    }
}

fn contains_in_dot(path: &Path) -> bool {
    if let Some(file_name) = path.file_name() {
        if let Some(file_name_str) = file_name.to_str() {
            return file_name_str.contains(".in.");
        }
    }

    false
}

fn strip_in_extension(path: &Path) -> Option<PathBuf> {
    if let Some(file_stem) = path.file_stem() {
        if let Some(file_stem_str) = file_stem.to_str() {
            let new_file_name = file_stem_str.replace(".in.", ".");
            if let Some(parent) = path.parent() {
                let mut new_path = PathBuf::from(parent);

                new_path.push(new_file_name);

                if let Some(extension) = path.extension() {
                    new_path.set_extension(extension);
                }

                return Some(new_path);
            }
        }
    }

    None
}
