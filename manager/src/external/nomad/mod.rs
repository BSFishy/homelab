use std::{env, process::Command, str::FromStr};

use regex::Regex;
use semver::Version;

#[derive(Debug)]
pub struct Nomad {
    command: String,
}

impl Default for Nomad {
    fn default() -> Self {
        let command = env::var("NOMAD")
            .inspect(|_command| log::trace!("Found Nomad environment variable for command"))
            .unwrap_or("nomad".to_string());

        log::debug!("Using Nomad command: {command}");

        Self { command }
    }
}

impl Nomad {
    fn command(&self) -> Command {
        Command::new(&self.command)
    }
}

// MARK: Version related functions
impl Nomad {
    pub fn version(&self) -> Result<Version, Box<dyn std::error::Error>> {
        let output = self.command().arg("-version").output()?;
        let output = String::from_utf8(output.stdout)?;
        let output = output.trim();

        log::trace!("Nomad version output: {output}");

        // Regex pulled from https://semver.org/
        let re = Regex::new(
            r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?",
        )?;
        let version_match = re.find(output).ok_or("Failed to find version")?;
        let version = version_match.as_str();
        log::debug!("Found Nomad version: {version}");

        Ok(Version::from_str(version)?)
    }

    pub fn validate_version(&self) -> Result<(), Box<dyn std::error::Error>> {
        let version = self.version()?;
        if version.major != 1 {
            return Err("Unsupported Nomad version".into());
        }

        if version.minor < 7 || (version.minor == 7 && version.patch < 7) {
            // TODO: should we error or just warn here?
            log::warn!("Lower version of Nomad detected, things may break!");
        }

        log::debug!("Valid Nomad version detected");

        Ok(())
    }
}
