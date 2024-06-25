use crate::{
    args::DeployArgs,
    external::nomad::{Job, Nomad},
};

pub fn deploy(_args: &DeployArgs) -> Result<(), Box<dyn std::error::Error>> {
    let nomad = Nomad::new();
    nomad.validate_version()?;

    let jobs: Result<Vec<_>, _> = glob::glob("**/service.hcl")?.collect();
    let jobs: Vec<_> = jobs?.iter().map(|path| Job::new(path)).collect();

    for job in jobs {
        log::info!("Job: {}", job.contents()?);
    }

    todo!()
}
