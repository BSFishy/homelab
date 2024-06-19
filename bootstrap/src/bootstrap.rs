use ignore::Walk;
use regex::{Captures, Regex, Replacer};
use std::{
    fs::{read_to_string, write},
    path::{Path, PathBuf},
};
use users::{get_current_gid, get_current_uid};

struct EnvReplacer;

impl Replacer for EnvReplacer {
    fn replace_append(&mut self, caps: &Captures<'_>, dst: &mut String) {
        let var = &caps[1];
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
            let new_file_name = file_stem_str.replace(".in", "");
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

pub fn bootstrap() {
    let re = Regex::new(r"\$\{([^}:]+)(?:\:([^}]+))?\}").unwrap();

    for result in Walk::new(std::env::current_dir().unwrap()) {
        let entry = result.unwrap();
        let path = entry.path();
        if path.is_dir() {
            continue;
        }

        if !contains_in_dot(path) {
            continue;
        }

        let file_contents = read_to_string(path).unwrap();
        let file_contents = re.replace_all(&file_contents, EnvReplacer);

        if let Some(new_path) = strip_in_extension(path) {
            write(&new_path, file_contents.as_ref()).unwrap();

            println!("Wrote {}", new_path.display());
        } else {
            eprintln!("Failed to write {}", path.display());
        }
    }
}
