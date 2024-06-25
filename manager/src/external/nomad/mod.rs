use std::{
    env,
    fs::File,
    io::{self, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    str::FromStr,
    thread,
};

use anyhow::{anyhow, bail, Context, Result};
use regex::Regex;
use semver::Version;

#[derive(Debug)]
pub struct Nomad {
    command: String,
}

impl Nomad {
    pub fn new() -> Nomad {
        let command = env::var("NOMAD")
            .inspect(|_command| log::trace!("Found Nomad environment variable for command"))
            .unwrap_or("nomad".to_string());

        log::debug!("Using Nomad command: {command}");

        Nomad { command }
    }

    fn command(&self) -> Command {
        Command::new(&self.command)
    }
}

// MARK: version related functions
impl Nomad {
    pub fn version(&self) -> Result<Version> {
        let output = self
            .command()
            .arg("-version")
            .output()
            .context("Failed to execute Nomad")?;

        let output =
            String::from_utf8(output.stdout).context("Failed to parse Nomad output as UTF-8")?;
        let output = output.trim();

        log::trace!("Nomad version output: {output}");

        // Regex pulled from https://semver.org/
        let re = Regex::new(
            r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?",
        ).context("Failed to parse version regular expression")?;

        let version_match = re
            .find(output)
            .ok_or(anyhow!("Failed to find version in command output"))?;
        let version = version_match.as_str();
        log::debug!("Found Nomad version: {version}");

        Ok(Version::from_str(version).context("Failed to parse Nomad version as semver")?)
    }

    pub fn validate_version(&self) -> Result<()> {
        let version = self.version().context("Failed to get Nomad version")?;
        if version.major != 1 {
            bail!("Unsupported Nomad version");
        }

        if version.minor < 7 || (version.minor == 7 && version.patch < 7) {
            // TODO: should we error or just warn here?
            log::warn!("Lower version of Nomad detected, things may break!");
        }

        log::debug!("Valid Nomad version detected");

        Ok(())
    }
}

// MARK: job related functions
impl Nomad {
    pub fn run(&self, job: Job) -> Result<()> {
        let mut command = self
            .command()
            .args(["job", "run", "-"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .context("Failed to spawn command")?;

        let mut stdin = command
            .stdin
            .take()
            .ok_or(anyhow!("Failed to get stdin of child process"))?;

        let join = thread::spawn(move || {
            job.pipe(&mut stdin)
                .context("Failed to pipe jobspec into child process")
        });

        let output = command
            .wait_with_output()
            .context("Failed to wait on child")?;

        join.join()
            .map_err(|_| anyhow!("Stdin thread panicked"))?
            .context("Failed to join the stdin pipe thread")?;

        let output = String::from_utf8_lossy(&output.stdout);
        log::trace!("{output}");

        Ok(())
    }
}

#[derive(Debug)]
pub struct Job {
    path: PathBuf,
}

impl Job {
    pub fn from_file(path: impl AsRef<Path>) -> Result<Job> {
        Ok(Job {
            path: path.as_ref().to_path_buf(),
        })
    }

    pub fn pipe(&self, writer: &mut impl Write) -> Result<()> {
        let mut file = File::open(&self.path).context("Failed to read jobspec file")?;

        io::copy(&mut file, writer).context("Failed to copy from jobspec file")?;

        Ok(())
    }
}
