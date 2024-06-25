use anyhow::{Context, Result};

use crate::{
    args::DeployArgs,
    external::nomad::{Job, Nomad},
};

pub fn deploy(_args: &DeployArgs) -> Result<()> {
    let nomad = Nomad::new();
    nomad
        .validate_version()
        .context("Failed to validate Nomad version")?;

    let jobs: Result<Vec<_>, _> = glob::glob("**/service.hcl")?.collect();
    let jobs: Result<Vec<_>, _> = jobs?.iter().map(|path| Job::from_file(path)).collect();

    for job in jobs? {
        log::info!("Deploying job");
        nomad.run(job)?;
    }

    Ok(())
}
